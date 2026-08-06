"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PortfolioTotals = {
  totalWoCount: number;
  totalBilled: number;
  turnBilled: number;
  controllableBilled: number;
  completedCount: number;
  canceledCount: number;
};

type TenantRow = {
  requesting_resident: string;
  total_wo_count: number;
  controllable_billed: number;
  liability_flag: "Low" | "Watch" | "Flag";
  liability_score: number;
  liability_reasons: string[];
  suggested_action: string;
  top_categories: { cat: string; count: number }[];
  last_wo_date: string | null;
};

type PropertyRow = {
  unit_address: string;
  property_id: string | null;
  total_wo_count: number;
  total_billed: number;
  turn_billed: number;
  controllable_billed: number;
  recurring_issue_count: number;
  top_categories: { cat: string; count: number }[];
  top_tenants: { name: string; count: number }[];
  last_wo_date: string | null;
};

type RecurringIssue = {
  address: string;
  category: string;
  count: number;
  completedCount: number;
};

type CategoryTotal = {
  category: string;
  count: number;
  billed: number;
  completedCount: number;
};

type PmGroup = {
  pmName: string;
  propertyCount: number;
  totalWoCount: number;
  controllableBilled: number;
};

type TodayWo = {
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

type HistoryRow = {
  work_order_number: string;
  unit_address: string | null;
  job_description: string | null;
  service_request_description: string | null;
  job_category: string | null;
  billed_amount: number | null;
  status: string | null;
  created_at_af: string | null;
};

type DashboardData = {
  portfolioTotals: PortfolioTotals;
  tenantWatchlist: TenantRow[];
  propertyWatchlist: PropertyRow[];
  recurringIssues: RecurringIssue[];
  categoryTotals: CategoryTotal[];
  pmBreakdown: PmGroup[];
  todayWorkOrders: TodayWo[];
  todayDate: string;
  activeTenantsLoaded: boolean;
  lastSyncedAt: string | null;
  lastSyncedCount?: number | null;
  lastSyncScope?: string | null;
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const flagStyles: Record<string, string> = {
  Flag: "bg-red-100 text-red-700",
  Watch: "bg-amber-100 text-amber-700",
  Low: "bg-emerald-100 text-emerald-700",
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "Not synced yet";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#eadfd5] bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-[#667085]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#101828]">{value}</p>
      {sub ? <p className="mt-1 text-xs text-[#667085]">{sub}</p> : null}
    </div>
  );
}

function SectionPanel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#eadfd5] bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#101828]">
        {title}
        {count !== undefined ? (
          <span className="rounded-full bg-[#eadfd5] px-2.5 py-0.5 text-sm font-medium text-[#667085]">
            {count}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function TodayWorkOrderCard({ wo }: { wo: TodayWo }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const summary =
    wo.service_request_description?.trim() ||
    wo.job_description?.trim() ||
    "No description";

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || history !== null) return;

    setLoadingHistory(true);
    setHistoryError("");
    try {
      const params = new URLSearchParams();
      if (wo.occupancy_id) {
        params.set("occupancy_id", wo.occupancy_id);
      } else {
        if (wo.requesting_resident) params.set("requesting_resident", wo.requesting_resident);
        if (wo.unit_address) params.set("unit_address", wo.unit_address);
      }
      params.set("exclude", wo.work_order_number);

      const res = await fetch(`/api/maintenance/history?${params}`);
      const payload = await res.json() as { history?: HistoryRow[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load history.");
      setHistory(payload.history ?? []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Failed to load history.");
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  const canExpand = Boolean(wo.occupancy_id || (wo.requesting_resident && wo.unit_address));

  return (
    <div className="rounded-lg border border-[#f05a28]/35 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={!canExpand && wo.history_count === 0}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#fff8f5] disabled:cursor-default disabled:hover:bg-white"
      >
        <span className="mt-0.5 w-4 shrink-0 text-[#f05a28]" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#101828]">#{wo.work_order_number}</span>
            <span className="truncate text-sm font-medium text-[#344054]">
              {wo.unit_address ?? "No address"}
            </span>
            <span className="rounded-full bg-[#f05a28] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              New
            </span>
            {wo.status ? (
              <span className="rounded-full bg-[#eadfd5] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#667085]">
                {wo.status}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[#52606d]">
            {wo.requesting_resident ?? "Vacant / no tenant"}
            {wo.job_category ? ` · ${wo.job_category}` : ""}
            {wo.created_at_af ? ` · ${formatShortDate(wo.created_at_af)}` : ""}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-[#101828]">{summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">History</p>
          <p className="text-lg font-semibold text-[#101828]">{wo.history_count}</p>
        </div>
      </button>

      {open ? (
        <div className="border-t border-[#eadfd5] bg-[#fbfaf8] px-4 py-3">
          {!wo.occupancy_id ? (
            <p className="mb-2 text-xs text-amber-700">
              No occupancy ID on this work order (likely vacant) — history unavailable or matched by tenant + address if present.
            </p>
          ) : null}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">
            Occupancy history ({wo.history_count} prior)
          </p>
          {loadingHistory ? (
            <p className="text-sm text-[#667085]">Loading history…</p>
          ) : historyError ? (
            <p className="text-sm text-red-700">{historyError}</p>
          ) : !history?.length ? (
            <p className="text-sm text-[#667085]">No prior work orders for this occupancy.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-[#667085]">
                  <tr>
                    <th className="pb-2 pr-3 font-semibold">Date</th>
                    <th className="pb-2 pr-3 font-semibold">WO #</th>
                    <th className="pb-2 pr-3 font-semibold">Issue</th>
                    <th className="pb-2 pr-3 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eadfd5]">
                  {history.map((h) => (
                    <tr key={h.work_order_number}>
                      <td className="py-2 pr-3 whitespace-nowrap text-[#475467]">
                        {formatShortDate(h.created_at_af)}
                      </td>
                      <td className="py-2 pr-3 font-medium text-[#101828]">{h.work_order_number}</td>
                      <td className="py-2 pr-3 text-[#475467]">
                        <span className="line-clamp-2">
                          {h.service_request_description?.trim() ||
                            h.job_description?.trim() ||
                            h.job_category ||
                            "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-[#475467]">{h.status ?? "—"}</td>
                      <td className="py-2 text-right text-[#101828]">
                        {h.billed_amount != null ? money.format(h.billed_amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ActiveTab = "tenants" | "properties" | "recurring" | "categories" | "pm";

const SYNC_POLL_MS = 60_000;

export default function MaintenanceIntelligencePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [autoRefreshNote, setAutoRefreshNote] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("tenants");
  const [flagFilter, setFlagFilter] = useState<"All" | "Flag" | "Watch">("All");
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  const loadDashboard = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch("/api/maintenance/dashboard");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to load dashboard.");
      setData(payload as DashboardData);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Unexpected error.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount fetch for dashboard JSON — async setState after await is intentional.
    const t = setTimeout(() => { void loadDashboard(); }, 0);
    return () => clearTimeout(t);
  }, [loadDashboard]);

  const knownSyncStampRef = useRef<string | null>(null);

  // Keep ref aligned when dashboard itself reports a stamp (initial load / Sync button)
  useEffect(() => {
    if (data?.lastSyncedAt) {
      knownSyncStampRef.current = data.lastSyncedAt;
    }
  }, [data?.lastSyncedAt]);

  // Poll sync stamp; when hourly/daily sync finishes, refresh open tabs from Supabase
  useEffect(() => {
    let cancelled = false;

    async function checkSyncStamp() {
      try {
        const res = await fetch("/api/maintenance/sync-status");
        if (!res.ok) return;
        const payload = await res.json() as { lastSyncedAt?: string | null };
        const next = payload.lastSyncedAt ?? null;
        if (!next) return;
        const known = knownSyncStampRef.current;
        if (known == null) {
          knownSyncStampRef.current = next;
          return;
        }
        if (next !== known) {
          knownSyncStampRef.current = next;
          if (!cancelled) {
            setAutoRefreshNote("Board updated from latest AppFolio pull.");
            await loadDashboard({ silent: true });
          }
        }
      } catch {
        // Ignore transient poll errors — next tick will retry
      }
    }

    const interval = setInterval(() => { void checkSyncStamp(); }, SYNC_POLL_MS);
    const first = setTimeout(() => { void checkSyncStamp(); }, 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(first);
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!autoRefreshNote) return;
    const t = setTimeout(() => setAutoRefreshNote(""), 8_000);
    return () => clearTimeout(t);
  }, [autoRefreshNote]);

  async function triggerSync() {
    setSyncing(true);
    setSyncResult("");
    setAutoRefreshNote("");
    try {
      const res = await fetch("/api/maintenance/sync", { method: "POST" });
      const payload = await res.json() as { message?: string; synced?: number; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Sync failed.");
      setSyncResult(`✓ ${payload.message} ${payload.synced ?? 0} records.`);
      await loadDashboard({ silent: true });
    } catch (err) {
      setSyncResult(`✗ ${err instanceof Error ? err.message : "Sync failed."}`);
    } finally {
      setSyncing(false);
    }
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "tenants", label: "Tenant Watchlist" },
    { key: "properties", label: "Property Watchlist" },
    { key: "recurring", label: "Recurring Issues" },
    { key: "categories", label: "By Category" },
    { key: "pm", label: "By PM Group" },
  ];

  const filteredTenants = data?.tenantWatchlist.filter(
    (t) => flagFilter === "All" || t.liability_flag === flagFilter,
  ) ?? [];

  const todayWos = data?.todayWorkOrders ?? [];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1d2430]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">

        {/* Header */}
        <header className="border-b border-[#f05a28]/20 pb-5">
          <Link href="/" className="text-sm font-semibold text-[#b74119] transition hover:text-[#8c2d12]">
            ← Back to TGPM Armory
          </Link>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#f05a28]">TGPM Armory</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#101828] sm:text-4xl">
                Maintenance Intelligence
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#52606d]">
                Review today&apos;s work orders with occupancy history before dispatch — plus tenant watchlist, property burden, and PM breakdown.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {syncResult ? (
                  <p className={`text-sm font-medium ${syncResult.startsWith("✓") ? "text-emerald-700" : "text-red-700"}`}>
                    {syncResult}
                  </p>
                ) : null}
                {autoRefreshNote ? (
                  <p className="text-sm font-medium text-emerald-700">{autoRefreshNote}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void triggerSync()}
                  disabled={syncing}
                  className="h-11 rounded-lg bg-[#f05a28] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d94d20] disabled:opacity-50"
                >
                  {syncing ? "Syncing…" : "Sync from AppFolio"}
                </button>
              </div>
              <p className="text-xs text-[#667085]">
                Last AppFolio pull: {formatSyncedAt(data?.lastSyncedAt ?? null)}
                {" · "}Board auto-refreshes after each pull
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-10 text-center text-sm text-[#667085]">Loading dashboard…</div>
        ) : !data ? null : (
          <div className="mt-6 flex-1 space-y-6 pb-8">

            {/* Portfolio totals */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Work Orders" value={data.portfolioTotals.totalWoCount.toLocaleString()} sub={`${data.portfolioTotals.completedCount} completed · ${data.portfolioTotals.canceledCount} canceled`} />
              <StatCard label="Total Billed" value={money.format(data.portfolioTotals.totalBilled)} sub="All work orders" />
              <StatCard label="Turn Billed" value={money.format(data.portfolioTotals.turnBilled)} sub="Unit turns excluded from burden" />
              <StatCard label="Controllable Maintenance" value={money.format(data.portfolioTotals.controllableBilled)} sub="Excludes turns & capital items" />
            </div>

            {/* Today's work orders — pinned for dispatch */}
            <section className="rounded-lg border border-[#f05a28]/40 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-[#101828]">
                    Today&apos;s Work Orders
                    <span className="rounded-full bg-[#f05a28] px-2.5 py-0.5 text-sm font-semibold text-white">
                      {todayWos.length} new
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-[#667085]">
                    {data.todayDate} (Eastern) — expand a card to see that occupancy&apos;s prior work orders before sending a vendor.
                  </p>
                </div>
              </div>

              {todayWos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#eadfd5] bg-[#fbfaf8] px-4 py-6 text-center text-sm text-[#667085]">
                  No new work orders today. Press Sync after AppFolio updates, or wait for the next scheduled pull.
                </p>
              ) : (
                <div className="space-y-3">
                  {todayWos.map((wo) => (
                    <TodayWorkOrderCard key={wo.work_order_number} wo={wo} />
                  ))}
                </div>
              )}
            </section>

            {/* Tabs */}
            <div className="border-b border-[#eadfd5]">
              <nav className="-mb-px flex gap-0 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                      activeTab === tab.key
                        ? "border-[#f05a28] text-[#f05a28]"
                        : "border-transparent text-[#667085] hover:text-[#344054]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tenant Watchlist — collapsed by default */}
            {activeTab === "tenants" && (
              <section className="rounded-lg border border-[#eadfd5] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setWatchlistOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-[#101828]">
                    <span className="text-[#f05a28]" aria-hidden>{watchlistOpen ? "▼" : "▶"}</span>
                    Tenant Watchlist
                    <span className="rounded-full bg-[#eadfd5] px-2.5 py-0.5 text-sm font-medium text-[#667085]">
                      {filteredTenants.length}
                    </span>
                  </h2>
                  <span className="text-sm text-[#667085]">
                    {watchlistOpen ? "Collapse" : "Expand Flag / Watch list"}
                  </span>
                </button>

                {watchlistOpen ? (
                  <div className="border-t border-[#eadfd5] px-5 pb-5 pt-4">
                    {data.activeTenantsLoaded ? (
                      <p className="mb-3 text-xs text-emerald-700">
                        ✓ Filtered to current tenants only — run Sync to refresh the tenant list
                      </p>
                    ) : (
                      <p className="mb-3 text-xs text-amber-700">
                        Showing all tenants (past + current) — press Sync to load current tenant directory and filter to active only
                      </p>
                    )}
                    <div className="mb-4 flex flex-wrap gap-2">
                      {(["All", "Flag", "Watch"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFlagFilter(f)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            flagFilter === f
                              ? "bg-[#f05a28] text-white"
                              : "bg-[#eadfd5] text-[#667085] hover:bg-[#d9cec2]"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="text-xs uppercase text-[#667085]">
                          <tr>
                            <th className="pb-3 pr-4 font-semibold">Tenant</th>
                            <th className="pb-3 pr-4 text-right font-semibold">WOs</th>
                            <th className="pb-3 pr-4 text-right font-semibold">Controllable Billed</th>
                            <th className="pb-3 pr-4 font-semibold">Flag</th>
                            <th className="pb-3 pr-4 font-semibold">Top Issues</th>
                            <th className="pb-3 font-semibold">Suggested Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eadfd5]">
                          {filteredTenants.map((t) => (
                            <tr key={t.requesting_resident} className="hover:bg-[#fbfaf8]">
                              <td className="py-3 pr-4 font-medium text-[#101828]">{t.requesting_resident}</td>
                              <td className="py-3 pr-4 text-right text-[#475467]">{t.total_wo_count}</td>
                              <td className="py-3 pr-4 text-right font-semibold text-[#101828]">{money.format(t.controllable_billed)}</td>
                              <td className="py-3 pr-4">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flagStyles[t.liability_flag] ?? ""}`}>
                                  {t.liability_flag}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-[#475467]">
                                {t.top_categories?.slice(0, 3).map((c) => c.cat).join(", ")}
                              </td>
                              <td className="py-3 text-xs text-[#667085]">{t.suggested_action}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredTenants.length === 0 ? (
                        <p className="mt-4 text-sm text-[#667085]">No tenants match this filter. Run a sync to populate data.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            {/* Property Watchlist */}
            {activeTab === "properties" && (
              <SectionPanel title="Property Watchlist" count={data.propertyWatchlist.length}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Property</th>
                        <th className="pb-3 pr-4 text-right font-semibold">WOs</th>
                        <th className="pb-3 pr-4 text-right font-semibold">Total Billed</th>
                        <th className="pb-3 pr-4 text-right font-semibold">Turn Billed</th>
                        <th className="pb-3 pr-4 text-right font-semibold">Controllable</th>
                        <th className="pb-3 pr-4 text-right font-semibold">Recurring</th>
                        <th className="pb-3 font-semibold">Top Categories</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eadfd5]">
                      {data.propertyWatchlist.map((p) => (
                        <tr key={p.unit_address} className="hover:bg-[#fbfaf8]">
                          <td className="max-w-[220px] truncate py-3 pr-4 font-medium text-[#101828]" title={p.unit_address}>
                            {p.unit_address}
                          </td>
                          <td className="py-3 pr-4 text-right text-[#475467]">{p.total_wo_count}</td>
                          <td className="py-3 pr-4 text-right text-[#475467]">{money.format(p.total_billed)}</td>
                          <td className="py-3 pr-4 text-right text-[#475467]">{money.format(p.turn_billed)}</td>
                          <td className="py-3 pr-4 text-right font-semibold text-[#101828]">{money.format(p.controllable_billed)}</td>
                          <td className="py-3 pr-4 text-right">
                            {p.recurring_issue_count > 0 ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                {p.recurring_issue_count} systems
                              </span>
                            ) : (
                              <span className="text-[#9e9e9e]">—</span>
                            )}
                          </td>
                          <td className="py-3 text-xs text-[#667085]">
                            {p.top_categories?.slice(0, 3).map((c) => c.cat).join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionPanel>
            )}

            {/* Recurring Issues */}
            {activeTab === "recurring" && (
              <SectionPanel title="Recurring Issues" count={data.recurringIssues.length}>
                <p className="mb-4 text-sm text-[#667085]">Same system / category flagged 3+ times at the same property.</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Property</th>
                        <th className="pb-3 pr-4 font-semibold">System / Category</th>
                        <th className="pb-3 pr-4 text-right font-semibold">Occurrences</th>
                        <th className="pb-3 text-right font-semibold">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eadfd5]">
                      {data.recurringIssues.map((r, i) => (
                        <tr key={i} className="hover:bg-[#fbfaf8]">
                          <td className="max-w-[260px] truncate py-3 pr-4 font-medium text-[#101828]" title={r.address}>
                            {r.address}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                              {r.category}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold text-[#101828]">{r.count}</td>
                          <td className="py-3 text-right text-[#475467]">{r.completedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {data.recurringIssues.length === 0 ? (
                    <p className="text-sm text-[#667085]">No recurring issues detected yet. Run a sync to populate data.</p>
                  ) : null}
                </div>
              </SectionPanel>
            )}

            {/* Category Breakdown */}
            {activeTab === "categories" && (
              <SectionPanel title="By Category" count={data.categoryTotals.length}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="text-xs uppercase text-[#667085]">
                      <tr>
                        <th className="pb-3 pr-4 font-semibold">Category</th>
                        <th className="pb-3 pr-4 text-right font-semibold">WOs</th>
                        <th className="pb-3 pr-4 text-right font-semibold">Completed</th>
                        <th className="pb-3 text-right font-semibold">Total Billed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eadfd5]">
                      {data.categoryTotals.map((c) => (
                        <tr key={c.category} className="hover:bg-[#fbfaf8]">
                          <td className="py-3 pr-4 font-medium text-[#101828]">{c.category}</td>
                          <td className="py-3 pr-4 text-right text-[#475467]">{c.count}</td>
                          <td className="py-3 pr-4 text-right text-[#475467]">{c.completedCount}</td>
                          <td className="py-3 text-right font-semibold text-[#101828]">{money.format(c.billed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionPanel>
            )}

            {/* PM Group Breakdown */}
            {activeTab === "pm" && (
              <SectionPanel title="By PM Group" count={data.pmBreakdown.length}>
                {data.pmBreakdown.length === 0 ? (
                  <p className="text-sm text-[#667085]">
                    PM assignments not found. Check that properties in work orders match addresses in the{" "}
                    <code className="rounded bg-[#eadfd5] px-1 py-0.5 text-xs">property_pm_assignments</code> table.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {data.pmBreakdown.map((pm) => (
                      <div key={pm.pmName} className="rounded-lg border border-[#eadfd5] bg-[#fbfaf8] p-4">
                        <p className="text-base font-semibold text-[#101828]">{pm.pmName}</p>
                        <p className="mt-1 text-xs text-[#667085]">{pm.propertyCount} properties</p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-[#667085]">Work Orders</p>
                            <p className="font-semibold text-[#101828]">{pm.totalWoCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#667085]">Controllable Billed</p>
                            <p className="font-semibold text-[#101828]">{money.format(pm.controllableBilled)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionPanel>
            )}

          </div>
        )}

        <footer className="border-t border-[#d9cec2]/60 py-5 text-center text-sm text-[#9e9e9e]">
          TGPM Internal Tools
        </footer>
      </div>
    </main>
  );
}
