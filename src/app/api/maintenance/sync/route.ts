import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import {
  classifyWorkOrder,
  normalizeJobCategory,
  scoreTenantLiability,
} from "@/lib/maintenance-classify";

export const runtime = "nodejs";
export const maxDuration = 300;

const REPORT_UUID = process.env.APPFOLIO_WORK_ORDER_REPORT_UUID ??
  "992bd507-8ef4-11f1-a5fc-0e19822e78a7";

type AppFolioRow = Record<string, string | null>;

// ─── AppFolio fetch ────────────────────────────────────────────────────────────

async function fetchAllRows(): Promise<AppFolioRow[]> {
  const vhost = process.env.APPFOLIO_VHOST;
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;

  if (!vhost || !clientId || !clientSecret) {
    throw new Error("Missing APPFOLIO_VHOST, APPFOLIO_CLIENT_ID, or APPFOLIO_CLIENT_SECRET.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const headers = {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };

  const allRows: AppFolioRow[] = [];
  let url: string | null =
    `https://${vhost}/api/v2/reports/saved/${REPORT_UUID}.json?limit=5000`;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AppFolio API error ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json() as {
      results?: AppFolioRow[];
      next_page_url?: string | null;
    };

    const rows = data.results ?? (Array.isArray(data) ? data as AppFolioRow[] : []);
    allRows.push(...rows);
    url = data.next_page_url ?? null;
  }

  return allRows;
}

// ─── Row mapping ───────────────────────────────────────────────────────────────

function parseDate(val: string | null | undefined): string | null {
  if (!val?.trim()) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parseAmount(val: string | null | undefined): number | null {
  if (!val?.trim()) return null;
  const n = parseFloat(val.replace(/[,$]/g, ""));
  return isNaN(n) ? null : n;
}

function mapRow(row: AppFolioRow) {
  // The report builder combines WO + billable reports.
  // Duplicate column names (Vendor, Created Date) — first occurrence = WO, second = billing.
  const keys = Object.keys(row);
  const vendorKeys = keys.filter((k) => k === "Vendor" || k === "vendor");
  const createdDateKeys = keys.filter((k) => k === "Created Date" || k === "created_date");

  const woVendor = vendorKeys[0] ? row[vendorKeys[0]] : null;
  const billingVendor = vendorKeys[1] ? row[vendorKeys[1]] : null;
  const billingCreatedDate = createdDateKeys[0] ? row[createdDateKeys[0]] : null;

  const jobDescription = row["Job Description"] ?? row["job_description"] ?? "";
  const billedAmount = parseAmount(row["Billed Amount"] ?? row["billed_amount"]) ?? 0;
  const jobCategory = normalizeJobCategory(jobDescription);
  const { isTurn, isCapital } = classifyWorkOrder(jobDescription, jobCategory, billedAmount);

  return {
    work_order_number: row["Work Order Number"] ?? row["work_order_number"] ?? "",
    unit_address: row["Unit Address"] ?? row["unit_address"] ?? null,
    property_id: row["Property ID"] ?? row["property_id"] ?? null,
    unit_id: row["Unit ID"] ?? row["unit_id"] ?? null,
    job_description: jobDescription || null,
    service_request_description: row["Service Request Description"] ?? row["service_request_description"] ?? null,
    instructions: row["Instructions"] ?? row["instructions"] ?? null,
    completion_description: row["Description"] ?? row["description"] ?? null,
    work_order_type: row["Work Order Type"] ?? row["work_order_type"] ?? null,
    priority: row["Priority"] ?? row["priority"] ?? null,
    wo_vendor: woVendor ?? null,
    wo_vendor_id: row["Vendor ID"] ?? row["vendor_id"] ?? null,
    created_at_af: parseDate(row["Created At"] ?? row["created_at"]),
    created_by: row["Created By"] ?? row["created_by"] ?? null,
    assigned_user: row["Assigned User"] ?? row["assigned_user"] ?? null,
    work_done_on: parseDate(row["Work Done On"] ?? row["work_done_on"]),
    completed_on: parseDate(row["Completed On"] ?? row["completed_on"]),
    canceled_on: parseDate(row["Canceled On"] ?? row["canceled_on"]),
    invoice: row["Invoice"] ?? row["invoice"] ?? null,
    status: row["Status"] ?? row["status"] ?? null,
    tenant_total_charge: parseAmount(row["Tenant Total Charge Amount"] ?? row["tenant_total_charge_amount"]),
    resident_requested: (row["Resident Requested"] ?? row["resident_requested"])?.trim()?.toLowerCase() === "yes",
    requesting_resident: row["Requesting Resident"] ?? row["requesting_resident"] ?? null,
    occupancy_id: row["Occupancy ID"] ?? row["occupancy_id"] ?? null,
    billing_vendor: billingVendor ?? null,
    billing_created_date: parseDate(billingCreatedDate),
    billable_type: row["Billable Type"] ?? row["billable_type"] ?? null,
    gl_account: row["GL Account"] ?? row["gl_account"] ?? null,
    billed_amount: billedAmount || null,
    appfolio_work_order_id: row["Work Order ID"] ?? row["work_order_id"] ?? null,
    job_category: jobCategory,
    is_turn: isTurn,
    is_capital: isCapital,
    updated_at: new Date().toISOString(),
  };
}

// ─── Summary refresh ──────────────────────────────────────────────────────────

async function refreshTenantSummaries() {
  const supabase = getSupabaseClient();

  const { data: rawRows } = await supabase
    .from("work_orders")
    .select("requesting_resident, job_category, billed_amount, is_turn, is_capital, status, completed_on, created_at_af, unit_address, service_request_description, instructions, completion_description")
    .not("requesting_resident", "is", null);

  const rows = rawRows as Array<Record<string, unknown>> | null;
  if (!rows?.length) return;

  const byTenant = new Map<string, typeof rows>();
  for (const row of rows) {
    const t = row.requesting_resident as string;
    if (!byTenant.has(t)) byTenant.set(t, []);
    byTenant.get(t)!.push(row);
  }

  const upserts = [];
  for (const [tenant, tenantRows] of byTenant) {
    const totalWos = tenantRows.length;
    const completed = tenantRows.filter((r) => r.status === "Completed").length;
    const canceled = tenantRows.filter((r) => r.status === "Canceled").length;
    const totalBilled = tenantRows.reduce((s, r) => s + (Number(r.billed_amount) || 0), 0);
    const controllable = tenantRows
      .filter((r) => !r.is_turn && !r.is_capital)
      .reduce((s, r) => s + (Number(r.billed_amount) || 0), 0);

    const dates = tenantRows
      .map((r) => r.created_at_af)
      .filter(Boolean)
      .sort() as string[];

    const catCounts: Record<string, number> = {};
    for (const r of tenantRows) {
      const c = (r.job_category as string) || "General Maintenance";
      catCounts[c] = (catCounts[c] || 0) + 1;
    }
    const topCategories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, count]) => ({ cat, count }));

    const propCounts: Record<string, number> = {};
    for (const r of tenantRows) {
      const a = (r.unit_address as string) || "Unknown";
      propCounts[a] = (propCounts[a] || 0) + 1;
    }
    const topProperties = Object.entries(propCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([address, count]) => ({ address, count }));

    const descriptions = tenantRows
      .flatMap((r) => [r.service_request_description, r.instructions, r.completion_description])
      .filter((d): d is string => Boolean(d));
    const { score, flag, matchedKeywords } = scoreTenantLiability(descriptions);

    const suggestedAction =
      flag === "Flag"
        ? "Call tenant — review lease compliance and consider Maintenance Liability checkbox in AppFolio"
        : flag === "Watch"
          ? "Monitor — review recent WOs for pattern before taking action"
          : "No action needed";

    upserts.push({
      requesting_resident: tenant,
      total_wo_count: totalWos,
      completed_wo_count: completed,
      canceled_wo_count: canceled,
      total_billed: totalBilled,
      controllable_billed: controllable,
      first_wo_date: dates[0] ?? null,
      last_wo_date: dates[dates.length - 1] ?? null,
      top_categories: topCategories,
      top_properties: topProperties,
      liability_flag: flag,
      liability_score: score,
      liability_reasons: matchedKeywords,
      suggested_action: suggestedAction,
      ai_analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  await supabase.from("summary_tenant_maintenance").upsert(upserts, {
    onConflict: "requesting_resident",
  });
}

async function refreshPropertySummaries() {
  const supabase = getSupabaseClient();

  const { data: rawPropRows } = await supabase
    .from("work_orders")
    .select("unit_address, property_id, job_category, billed_amount, is_turn, is_capital, status, created_at_af, requesting_resident");

  const rows = rawPropRows as Array<Record<string, unknown>> | null;
  if (!rows?.length) return;

  const byProp = new Map<string, typeof rows>();
  for (const row of rows) {
    const a = (row.unit_address as string) || "Unknown";
    if (!byProp.has(a)) byProp.set(a, []);
    byProp.get(a)!.push(row);
  }

  const upserts = [];
  for (const [address, propRows] of byProp) {
    const totalBilled = propRows.reduce((s, r) => s + (Number(r.billed_amount) || 0), 0);
    const turnBilled = propRows.filter((r) => r.is_turn).reduce((s, r) => s + (Number(r.billed_amount) || 0), 0);
    const controllable = propRows.filter((r) => !r.is_turn && !r.is_capital).reduce((s, r) => s + (Number(r.billed_amount) || 0), 0);

    const catCounts: Record<string, number> = {};
    for (const r of propRows) {
      const c = (r.job_category as string) || "General Maintenance";
      catCounts[c] = (catCounts[c] || 0) + 1;
    }
    const topCategories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]) => ({ cat, count }));

    const catThree = Object.entries(catCounts).filter(([, count]) => count >= 3);

    const dates = propRows.map((r) => r.created_at_af).filter(Boolean).sort() as string[];

    const tenantCounts: Record<string, number> = {};
    for (const r of propRows) {
      const t = (r.requesting_resident as string) || "";
      if (t) tenantCounts[t] = (tenantCounts[t] || 0) + 1;
    }
    const topTenants = Object.entries(tenantCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));

    upserts.push({
      unit_address: address,
      property_id: propRows[0]?.property_id ?? null,
      total_wo_count: propRows.length,
      completed_wo_count: propRows.filter((r) => r.status === "Completed").length,
      total_billed: totalBilled,
      turn_billed: turnBilled,
      controllable_billed: controllable,
      recurring_issue_count: catThree.length,
      top_categories: topCategories,
      top_tenants: topTenants,
      first_wo_date: dates[0] ?? null,
      last_wo_date: dates[dates.length - 1] ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  await supabase.from("summary_property_work_orders").upsert(upserts, {
    onConflict: "unit_address",
  });
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Simple bearer token check to prevent unauthorized triggers
    const auth = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;
    if (secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await fetchAllRows();
    if (!rows.length) {
      return NextResponse.json({ message: "No rows returned from AppFolio.", synced: 0 });
    }

    const mapped = rows
      .map(mapRow)
      .filter((r) => r.work_order_number?.trim());

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("work_orders")
      .upsert(mapped, { onConflict: "work_order_number" });

    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);

    await Promise.all([refreshTenantSummaries(), refreshPropertySummaries()]);

    return NextResponse.json({
      message: "Sync complete.",
      synced: mapped.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected sync error." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Use POST to trigger sync." }, { status: 405 });
}
