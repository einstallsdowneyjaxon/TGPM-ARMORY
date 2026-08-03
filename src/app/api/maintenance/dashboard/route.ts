import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    const [
      { data: tenantWatchlist },
      { data: propertyWatchlist },
      { data: recurringIssues },
      { data: categoryTotals },
      { data: pmBreakdown },
      { data: recentActivity },
    ] = await Promise.all([
      // Top tenants by WO count, flagged
      supabase
        .from("summary_tenant_maintenance")
        .select("requesting_resident, total_wo_count, controllable_billed, liability_flag, liability_score, liability_reasons, suggested_action, top_categories, last_wo_date")
        .gte("total_wo_count", 3)
        .order("total_wo_count", { ascending: false })
        .limit(50),

      // Top properties by controllable billed
      supabase
        .from("summary_property_work_orders")
        .select("unit_address, property_id, total_wo_count, total_billed, turn_billed, controllable_billed, recurring_issue_count, top_categories, top_tenants, last_wo_date")
        .order("controllable_billed", { ascending: false })
        .limit(50),

      // Recurring issues: properties with same category 3+ times
      supabase
        .from("work_orders")
        .select("unit_address, job_category, status")
        .neq("job_category", "Unit Turn")
        .not("unit_address", "is", null),

      // Category breakdown totals
      supabase
        .from("work_orders")
        .select("job_category, billed_amount, is_turn, is_capital, status"),

      // PM group breakdown via property_pm_assignments join
      supabase
        .from("property_pm_assignments")
        .select("property_address, effective_sor, pm_directory(pm_name)")
        .eq("is_active", true),

      // Last 90 days activity
      supabase
        .from("work_orders")
        .select("work_order_number, unit_address, job_description, job_category, billed_amount, status, created_at_af, requesting_resident, is_turn, is_capital")
        .gte("created_at_af", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .order("created_at_af", { ascending: false })
        .limit(200),
    ]);

    // Portfolio totals
    const allWos = (categoryTotals ?? []) as CatRow[];

    // Compute recurring issues from raw data
    const recurring = computeRecurringIssues((recurringIssues ?? []) as WoRow[]);

    // Compute category totals
    const categories = computeCategoryTotals(allWos);

    // Build PM → properties map
    const pmMap = buildPmMap((pmBreakdown ?? []) as unknown as PmRow[], (propertyWatchlist ?? []) as PropRow[]);
    const portfolioTotals = {
      totalWoCount: allWos.length,
      totalBilled: allWos.reduce((s, r) => s + (Number(r.billed_amount) || 0), 0),
      turnBilled: allWos.filter((r) => r.is_turn).reduce((s, r) => s + (Number(r.billed_amount) || 0), 0),
      controllableBilled: allWos.filter((r) => !r.is_turn && !r.is_capital).reduce((s, r) => s + (Number(r.billed_amount) || 0), 0),
      completedCount: allWos.filter((r) => r.status === "Completed").length,
      canceledCount: allWos.filter((r) => r.status === "Canceled").length,
    };

    return NextResponse.json({
      portfolioTotals,
      tenantWatchlist: tenantWatchlist ?? [],
      propertyWatchlist: propertyWatchlist ?? [],
      recurringIssues: recurring,
      categoryTotals: categories,
      pmBreakdown: pmMap,
      recentActivity: recentActivity ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Dashboard query failed." },
      { status: 500 },
    );
  }
}

type WoRow = { unit_address: string | null; job_category: string | null; status: string | null };

function computeRecurringIssues(rows: WoRow[]) {
  const counts: Record<string, { address: string; category: string; count: number; completedCount: number }> = {};
  for (const row of rows) {
    if (!row.unit_address || !row.job_category) continue;
    const key = `${row.unit_address}||${row.job_category}`;
    if (!counts[key]) counts[key] = { address: row.unit_address, category: row.job_category, count: 0, completedCount: 0 };
    counts[key].count++;
    if (row.status === "Completed") counts[key].completedCount++;
  }
  return Object.values(counts)
    .filter((r) => r.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

type CatRow = { job_category: string | null; billed_amount: number | null; is_turn: boolean | null; is_capital: boolean | null; status: string | null };

function computeCategoryTotals(rows: CatRow[]) {
  const totals: Record<string, { category: string; count: number; billed: number; completedCount: number }> = {};
  for (const row of rows) {
    const cat = row.job_category || "General Maintenance";
    if (!totals[cat]) totals[cat] = { category: cat, count: 0, billed: 0, completedCount: 0 };
    totals[cat].count++;
    totals[cat].billed += Number(row.billed_amount) || 0;
    if (row.status === "Completed") totals[cat].completedCount++;
  }
  return Object.values(totals).sort((a, b) => b.billed - a.billed);
}

type PmRow = { property_address: string | null; effective_sor: string | null; pm_directory: { pm_name: string } | null };
type PropRow = { unit_address: string | null; total_wo_count: number | null; controllable_billed: number | null };

function buildPmMap(pmRows: PmRow[], propRows: PropRow[]) {
  const propMap = new Map<string, PropRow>();
  for (const p of propRows) {
    if (p.unit_address) propMap.set(p.unit_address.toLowerCase(), p);
  }

  const pmGroups: Record<string, { pmName: string; propertyCount: number; totalWoCount: number; controllableBilled: number }> = {};

  for (const pmRow of pmRows) {
    const pmName = pmRow.pm_directory?.pm_name ?? pmRow.effective_sor ?? "Unassigned";
    if (!pmGroups[pmName]) pmGroups[pmName] = { pmName, propertyCount: 0, totalWoCount: 0, controllableBilled: 0 };

    pmGroups[pmName].propertyCount++;

    const address = pmRow.property_address?.toLowerCase() ?? "";
    const prop = address ? propMap.get(address) : null;
    if (prop) {
      pmGroups[pmName].totalWoCount += prop.total_wo_count ?? 0;
      pmGroups[pmName].controllableBilled += Number(prop.controllable_billed) || 0;
    }
  }

  return Object.values(pmGroups).sort((a, b) => b.controllableBilled - a.controllableBilled);
}
