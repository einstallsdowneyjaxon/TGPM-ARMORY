import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** Calendar date in America/New_York (TGPM / AppFolio local day). */
function etToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type TodayWoRow = {
  work_order_number: string;
  unit_address: string | null;
  job_description: string | null;
  service_request_description: string | null;
  job_category: string | null;
  billed_amount: number | null;
  status: string | null;
  created_at_af: string | null;
  requesting_resident: string | null;
  occupancy_id: string | null;
  is_turn: boolean | null;
  is_capital: boolean | null;
  history_count: number;
};

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const today = etToday();

    // Get active tenant names for filtering
    const { data: activeTenantRows } = await supabase
      .from("active_tenants")
      .select("full_name, normalized_name");

    const activeNames = new Set(
      (activeTenantRows ?? []).flatMap((r) => [
        (r.full_name as string | null)?.toLowerCase().trim() ?? "",
        (r.normalized_name as string | null)?.toLowerCase().trim() ?? "",
      ]).filter(Boolean),
    );

    const hasActiveTenants = activeNames.size > 0;

    const [
      { data: tenantWatchlist },
      { data: propertyWatchlist },
      { data: recurringIssues },
      { data: categoryTotals },
      { data: pmBreakdown },
      { data: recentActivity },
      { data: todayRows },
    ] = await Promise.all([
      // Tenants — filtered to active if tenant directory has been synced
      supabase
        .from("summary_tenant_maintenance")
        .select("requesting_resident, total_wo_count, controllable_billed, liability_flag, liability_score, liability_reasons, suggested_action, top_categories, last_wo_date")
        .gte("total_wo_count", 3)
        .order("total_wo_count", { ascending: false })
        .limit(500),

      // Properties — no cap, sorted by controllable billed
      supabase
        .from("summary_property_work_orders")
        .select("unit_address, property_id, total_wo_count, total_billed, turn_billed, controllable_billed, recurring_issue_count, top_categories, top_tenants, last_wo_date")
        .order("controllable_billed", { ascending: false, nullsFirst: false })
        .limit(500),

      // Recurring issues
      supabase
        .from("work_orders")
        .select("unit_address, job_category, status")
        .neq("job_category", "Unit Turn")
        .not("unit_address", "is", null)
        .limit(20000),

      // Category breakdown totals — limit raised to cover full dataset
      supabase
        .from("work_orders")
        .select("job_category, billed_amount, is_turn, is_capital, status")
        .limit(20000),

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

      // Today's work orders (America/New_York calendar day)
      supabase
        .from("work_orders")
        .select("work_order_number, unit_address, job_description, service_request_description, job_category, billed_amount, status, created_at_af, requesting_resident, occupancy_id, is_turn, is_capital")
        .eq("created_at_af", today)
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
    // Portfolio totals via SQL to bypass Supabase 1000-row REST cap
    const { data: statsRow } = await supabase.rpc("get_portfolio_maintenance_stats");
    const stats = (statsRow as Record<string, number> | null) ?? {};
    const portfolioTotals = {
      totalWoCount: Number(stats.total_wo_count ?? allWos.length),
      totalBilled: Number(stats.total_billed ?? allWos.reduce((s, r) => s + (Number(r.billed_amount) || 0), 0)),
      turnBilled: Number(stats.turn_billed ?? 0),
      controllableBilled: Number(stats.controllable_billed ?? 0),
      completedCount: Number(stats.completed_count ?? allWos.filter((r) => r.status === "Completed").length),
      canceledCount: Number(stats.canceled_count ?? allWos.filter((r) => r.status === "Canceled").length),
    };

    // Filter tenant list to active tenants only (when directory has been synced)
    type TenantRow = { requesting_resident: string | null; [key: string]: unknown };
    const filteredTenants = hasActiveTenants
      ? (tenantWatchlist ?? []).filter((t) => {
          const name = ((t as TenantRow).requesting_resident ?? "").toLowerCase().trim();
          if (!name) return false;
          if (activeNames.has(name)) return true;
          // Also try "Lastname, Firstname" → "Firstname Lastname" normalization
          const parts = name.split(",").map((p) => p.trim());
          const flipped = parts.length === 2 ? `${parts[1]} ${parts[0]}` : name;
          const sorted = name.split(/[\s,]+/).sort().join(" ");
          return activeNames.has(flipped) || activeNames.has(sorted);
        })
      : (tenantWatchlist ?? []);

    // History counts for today's cards (prior WOs for same occupancy)
    const todayList = (todayRows ?? []) as Omit<TodayWoRow, "history_count">[];
    const occIds = [...new Set(todayList.map((r) => r.occupancy_id).filter(Boolean))] as string[];
    const historyByOcc = new Map<string, number>();

    if (occIds.length > 0) {
      await Promise.all(
        occIds.map(async (occId) => {
          const { count } = await supabase
            .from("work_orders")
            .select("work_order_number", { count: "exact", head: true })
            .eq("occupancy_id", occId);
          // Subtract today's WOs for this occupancy so badge = prior history
          const todayForOcc = todayList.filter((r) => r.occupancy_id === occId).length;
          historyByOcc.set(occId, Math.max(0, (count ?? 0) - todayForOcc));
        }),
      );
    }

    const todayWorkOrders: TodayWoRow[] = todayList.map((r) => ({
      ...r,
      history_count: r.occupancy_id ? (historyByOcc.get(r.occupancy_id) ?? 0) : 0,
    }));

    const { data: syncState } = await supabase
      .from("maintenance_sync_state")
      .select("last_synced_at, last_synced_count, last_sync_scope")
      .eq("id", "default")
      .maybeSingle();

    return NextResponse.json({
      portfolioTotals,
      tenantWatchlist: filteredTenants,
      propertyWatchlist: propertyWatchlist ?? [],
      recurringIssues: recurring,
      categoryTotals: categories,
      pmBreakdown: pmMap,
      recentActivity: recentActivity ?? [],
      todayWorkOrders,
      todayDate: today,
      activeTenantsLoaded: hasActiveTenants,
      lastSyncedAt: (syncState?.last_synced_at as string | null) ?? null,
      lastSyncedCount: syncState?.last_synced_count ?? null,
      lastSyncScope: syncState?.last_sync_scope ?? null,
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
