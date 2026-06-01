"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ledgerCategoryLabels,
  maintenanceSubcategoryLabels,
  parseAppFolioGeneralLedger,
  type LedgerCategory,
  type MaintenanceSubcategory,
  type PropertyHealthReport,
} from "@/lib/property-health";

type AiAnalysis = {
  overallHealthScore: number;
  maintenanceTrendScore: number;
  risingCostAlerts: string[];
  recurringIssueDetection: string[];
  ownerFacingSummary: string;
  internalTgpmActionPlan: string[];
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const operatingCategories: LedgerCategory[] = [
  "operating_income",
  "maintenance",
  "management_fees",
  "leasing_fees",
  "utilities",
  "legal",
  "taxes_insurance",
  "hoa",
  "owner_contributions",
  "owner_distributions",
  "true_uncategorized",
];

const excludedCategories: LedgerCategory[] = [
  "security_deposits_liabilities",
  "internal_transfers_clearing",
  "balance_sheet_non_operating",
];

export default function PropertyHealthAnalyzerPage() {
  const [report, setReport] = useState<PropertyHealthReport | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisState, setAnalysisState] = useState<
    "idle" | "loading" | "complete" | "missing-key" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const maxMonthlyValue = useMemo(() => {
    if (!report?.monthlyTrends.length) return 1;

    return Math.max(
      ...report.monthlyTrends.map((month) =>
        Math.max(month.income, month.expenses, month.maintenance),
      ),
      1,
    );
  }, [report]);

  const trueUncategorizedPct = report?.totals.operatingTotal
    ? (report.totals.trueUncategorized / report.totals.operatingTotal) * 100
    : 0;
  const hasDataWarning =
    Boolean(report) &&
    (trueUncategorizedPct > 10 || (report?.totals.excludedNonOperating ?? 0) > 0);

  async function handleFileUpload(file: File | null) {
    if (!file) return;

    setError("");
    setAnalysis(null);
    setAnalysisState("idle");
    setFileName(file.name);

    try {
      setReport(parseAppFolioGeneralLedger(await file.text()));
    } catch (uploadError) {
      setReport(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to parse that CSV file.",
      );
    }
  }

  async function loadStarterCsv() {
    setError("");
    setAnalysis(null);
    setAnalysisState("idle");
    setFileName("general_ledger-20260531.csv");

    try {
      const response = await fetch("/sample-general-ledger.csv");
      if (!response.ok) throw new Error("Starter CSV was not found in the app.");
      setReport(parseAppFolioGeneralLedger(await response.text()));
    } catch (starterError) {
      setReport(null);
      setError(
        starterError instanceof Error
          ? starterError.message
          : "Unable to load starter CSV.",
      );
    }
  }

  async function runAiAnalysis() {
    if (!report) return;

    setIsAnalyzing(true);
    setAnalysisState("loading");
    setAnalysis(null);
    setError("");

    try {
      const response = await fetch("/api/property-health-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          setAnalysisState("missing-key");
        } else {
          setAnalysisState("error");
        }
        throw new Error(payload.error ?? "AI analysis failed.");
      }

      setAnalysis(payload.analysis);
      setAnalysisState("complete");
    } catch (analysisError) {
      setAnalysis(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Unable to generate AI analysis.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopyStatus(`${label} copied`);
    window.setTimeout(() => setCopyStatus(""), 2000);
  }

  function downloadText(fileSlug: string, text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileSlug}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const internalPlan = analysis?.internalTgpmActionPlan.join("\n") ?? "";

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#1d2430]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-[#f05a28]/20 pb-5">
          <Link
            href="/"
            className="text-sm font-semibold text-[#b74119] transition hover:text-[#8c2d12]"
          >
            Back to TGPM Armory
          </Link>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#f05a28]">
                TGPM Armory
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[#101828] sm:text-4xl">
                Property Health Analyzer
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[#52606d]">
                Upload an AppFolio GL CSV to isolate operating performance,
                audit excluded accounting movement, and spot maintenance cost
                trends early.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={loadStarterCsv}
                className="h-11 rounded-lg border border-[#f05a28]/35 bg-white px-4 text-sm font-semibold text-[#b74119] shadow-sm transition hover:border-[#f05a28]"
              >
                Load starter CSV
              </button>
              <label className="flex h-11 cursor-pointer items-center justify-center rounded-lg bg-[#f05a28] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d94d20]">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) =>
                    void handleFileUpload(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>
          </div>
        </header>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {copyStatus ? <Alert tone="success">{copyStatus}</Alert> : null}

        {!report ? (
          <section className="mt-6 grid flex-1 place-items-center rounded-lg border border-dashed border-[#d9cec2] bg-white/70 px-5 py-16 text-center">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold text-[#101828]">
                Start with an AppFolio General Ledger CSV
              </h2>
              <p className="mt-3 text-base leading-7 text-[#52606d]">
                Deterministic math stays in code. Excluded trust, liability,
                clearing, and balance sheet movement stays visible for audit.
              </p>
            </div>
          </section>
        ) : (
          <div className="flex-1 py-6">
            <section className="mb-5 flex flex-col gap-3 rounded-lg border border-[#eadfd5] bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#b74119]">
                  {fileName}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#101828]">
                  {report.propertyName}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">
                  {report.rowCount} rows from {report.dateRange.start} to{" "}
                  {report.dateRange.end}
                </p>
              </div>
              <button
                type="button"
                onClick={runAiAnalysis}
                disabled={isAnalyzing}
                className="h-11 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white transition hover:bg-[#27364a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAnalyzing ? "Analyzing..." : "Generate AI analysis"}
              </button>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Operating income"
                value={report.totals.operatingIncome}
              />
              <MetricCard label="Rent income" value={report.totals.rentIncome} />
              <MetricCard
                label="Operating expenses"
                value={report.totals.operatingExpenses}
              />
              <MetricCard
                label="Maintenance total"
                value={report.totals.maintenanceTotal}
              />
              <MetricCard
                label="Management fees"
                value={report.totals.managementFees}
              />
              <MetricCard
                label="Leasing fees"
                value={report.totals.leasingFees}
              />
              <MetricCard label="Utilities" value={report.totals.utilities} />
              <MetricCard
                label="Estimated NOI / cash flow"
                value={report.totals.estimatedNoiCashFlow}
                emphasis
              />
            </section>

            {hasDataWarning ? (
              <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h2 className="text-lg font-semibold text-amber-950">
                  Potential Data Warning
                </h2>
                <div className="mt-2 space-y-2 text-sm leading-6 text-amber-900">
                  {trueUncategorizedPct > 10 ? (
                    <p>
                      True Uncategorized is{" "}
                      {percentFormatter.format(trueUncategorizedPct)}% of
                      operating activity. Review the source accounts before
                      relying on the health scoring.
                    </p>
                  ) : null}
                  {report.totals.excludedNonOperating > 0 ? (
                    <p>
                      {moneyFormatter.format(report.totals.excludedNonOperating)}{" "}
                      in trust, liability, clearing, or balance sheet movement
                      was excluded from income, expenses, NOI, health scoring,
                      and AI maintenance analysis.
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel title="Monthly Trends">
                <div className="space-y-3">
                  {report.monthlyTrends.map((month) => (
                    <div key={month.month}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-[#344054]">
                          {month.month}
                        </span>
                        <span className="text-[#667085]">
                          {moneyFormatter.format(month.income - month.expenses)}
                        </span>
                      </div>
                      <TrendBar
                        label="Income"
                        value={month.income}
                        max={maxMonthlyValue}
                        color="bg-emerald-500"
                      />
                      <TrendBar
                        label="Expenses"
                        value={month.expenses}
                        max={maxMonthlyValue}
                        color="bg-[#f05a28]"
                      />
                      <TrendBar
                        label="Maintenance"
                        value={month.maintenance}
                        max={maxMonthlyValue}
                        color="bg-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Operating Category Breakdown">
                <CategoryList
                  categories={operatingCategories}
                  totals={report.categories}
                  labels={ledgerCategoryLabels}
                />
                <div className="mt-5 border-t border-[#eadfd5] pt-4">
                  <h3 className="text-sm font-semibold text-[#101828]">
                    Maintenance subcategories
                  </h3>
                  <CategoryList
                    totals={report.maintenanceSubcategories}
                    labels={maintenanceSubcategoryLabels}
                    compact
                  />
                </div>
              </Panel>
            </section>

            <section className="mt-5">
              <Panel title="Maintenance Watchlist">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {report.maintenanceWatchlist.map((item) => (
                    <div
                      key={item.subcategory}
                      className="rounded-lg border border-[#eadfd5] bg-[#fbfaf8] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-[#101828]">
                            {item.label}
                          </h3>
                          <p className="mt-1 text-sm text-[#667085]">
                            {item.transactionCount} transactions
                          </p>
                        </div>
                        <RiskBadge risk={item.riskLevel} />
                      </div>
                      <p className="mt-3 text-xl font-semibold text-[#101828]">
                        {moneyFormatter.format(item.amount)}
                      </p>
                      <p className="mt-1 text-sm text-[#667085]">
                        Trend: {item.trendDirection}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-3">
              <Panel title="Year-over-Year">
                {report.yearOverYear.available ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-[#667085]">
                      {report.yearOverYear.currentPeriodLabel} vs{" "}
                      {report.yearOverYear.priorPeriodLabel}
                    </p>
                    <YoYLine
                      label="Income"
                      value={report.yearOverYear.incomeChangePct}
                    />
                    <YoYLine
                      label="Expenses"
                      value={report.yearOverYear.expenseChangePct}
                    />
                    <YoYLine
                      label="Maintenance"
                      value={report.yearOverYear.maintenanceChangePct}
                    />
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-[#667085]">
                    {report.yearOverYear.currentPeriodLabel}. Upload a longer
                    ledger export to compare full trailing years.
                  </p>
                )}
              </Panel>

              <Panel title="AI Status">
                <AiStatus state={analysisState} />
                {analysis ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Score label="Overall" value={analysis.overallHealthScore} />
                    <Score
                      label="Maintenance"
                      value={analysis.maintenanceTrendScore}
                    />
                  </div>
                ) : null}
              </Panel>

              <Panel title="Parser Notes">
                <p className="text-sm text-[#667085]">
                  {report.operatingRowCount} operating rows analyzed.{" "}
                  {report.excludedRowCount} non-operating rows excluded from
                  scoring.
                </p>
              </Panel>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <Panel title="Excluded Non-Operating Activity">
                <CategoryList
                  categories={excludedCategories}
                  totals={report.categories}
                  labels={ledgerCategoryLabels}
                />
              </Panel>

              <Panel title="Top Excluded Accounts">
                <SummaryTable items={report.topExcludedAccounts} />
              </Panel>

              {report.topTrueUncategorizedAccounts.length ? (
                <Panel title="True Uncategorized Audit">
                  <SummaryTable items={report.topTrueUncategorizedAccounts} />
                </Panel>
              ) : null}
            </section>

            {analysis ? (
              <section className="mt-5 grid gap-5 xl:grid-cols-2">
                <Panel title="Owner-Facing Summary">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[#475467]">
                    {analysis.ownerFacingSummary}
                  </p>
                  <ExportButtons
                    onCopy={() =>
                      void copyText("Owner summary", analysis.ownerFacingSummary)
                    }
                    onDownload={() =>
                      downloadText(
                        "property-health-owner-summary",
                        analysis.ownerFacingSummary,
                      )
                    }
                  />
                </Panel>

                <Panel title="Internal TGPM Action Plan">
                  <List items={analysis.internalTgpmActionPlan} />
                  <ExportButtons
                    onCopy={() =>
                      void copyText("Internal action plan", internalPlan)
                    }
                    onDownload={() =>
                      downloadText(
                        "property-health-internal-action-plan",
                        internalPlan,
                      )
                    }
                  />
                </Panel>

                <Panel title="Rising Cost Alerts">
                  <List items={analysis.risingCostAlerts} />
                </Panel>

                <Panel title="Recurring Issue Detection">
                  <List items={analysis.recurringIssueDetection} />
                </Panel>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <article
      className={`rounded-lg border p-4 shadow-sm ${
        emphasis
          ? "border-[#f05a28]/35 bg-[#fff4ed]"
          : "border-[#eadfd5] bg-white"
      }`}
    >
      <p className="text-sm font-medium text-[#667085]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#101828]">
        {moneyFormatter.format(value)}
      </p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#eadfd5] bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-[#101828]">{title}</h2>
      {children}
    </section>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <section className={`mt-5 rounded-lg border px-4 py-3 text-sm ${classes}`}>
      {children}
    </section>
  );
}

function TrendBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="mb-1 grid grid-cols-[88px_1fr_92px] items-center gap-2 text-xs text-[#667085]">
      <span>{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-[#f2eee9]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max((value / max) * 100, 1)}%` }}
        />
      </div>
      <span className="text-right">{moneyFormatter.format(value)}</span>
    </div>
  );
}

function CategoryList<T extends LedgerCategory | MaintenanceSubcategory>({
  totals,
  labels,
  categories,
  compact = false,
}: {
  totals: Record<T, number>;
  labels: Record<T, string>;
  categories?: T[];
  compact?: boolean;
}) {
  const entries = (categories ?? (Object.keys(totals) as T[]))
    .map((key) => [key, totals[key]] as const)
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  if (!entries.length) {
    return <p className="text-sm text-[#667085]">No categorized dollars yet.</p>;
  }

  return (
    <div className={compact ? "mt-3 space-y-2" : "space-y-2"}>
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[#475467]">{labels[key]}</span>
          <span className="font-semibold text-[#101828]">
            {moneyFormatter.format(Number(value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function SummaryTable({
  items,
}: {
  items: Array<{ account?: string; label?: string; rows: number; amount: number }>;
}) {
  if (!items.length) {
    return <p className="text-sm text-[#667085]">No rows in this bucket.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="text-xs uppercase text-[#667085]">
          <tr>
            <th className="pb-2 font-semibold">GL Account</th>
            <th className="pb-2 text-right font-semibold">Rows</th>
            <th className="pb-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eadfd5]">
          {items.map((item) => (
            <tr key={item.account ?? item.label}>
              <td className="py-2 pr-3 text-[#475467]">
                {item.account ?? item.label}
              </td>
              <td className="py-2 text-right text-[#475467]">{item.rows}</td>
              <td className="py-2 text-right font-semibold text-[#101828]">
                {moneyFormatter.format(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YoYLine({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#475467]">{label}</span>
      <span className="font-semibold text-[#101828]">
        {value === null ? "N/A" : `${percentFormatter.format(value)}%`}
      </span>
    </div>
  );
}

function AiStatus({
  state,
}: {
  state: "idle" | "loading" | "complete" | "missing-key" | "error";
}) {
  const messages = {
    idle: "Ready. Generate analysis after reviewing the calculated operating totals.",
    loading: "Loading analysis from the OpenAI route...",
    complete: "AI analysis complete.",
    "missing-key":
      "Missing OPENAI_API_KEY. Add it to .env.local, then restart the dev server.",
    error: "The API returned an error. See the red message above for details.",
  };

  return <p className="text-sm leading-6 text-[#667085]">{messages[state]}</p>;
}

function RiskBadge({ risk }: { risk: "Low" | "Moderate" | "High" }) {
  const classes =
    risk === "High"
      ? "bg-red-50 text-red-700"
      : risk === "Moderate"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>
      {risk}
    </span>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const normalized = Math.round(value);
  const color =
    normalized >= 75
      ? "text-emerald-700"
      : normalized >= 50
        ? "text-amber-700"
        : "text-red-700";

  return (
    <div className="rounded-lg border border-[#eadfd5] bg-[#fbfaf8] p-3">
      <p className="text-xs font-medium text-[#667085]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{normalized}</p>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items.length) {
    return <p className="text-sm text-[#667085]">No items returned.</p>;
  }

  return (
    <ul className="space-y-2 text-sm leading-6 text-[#475467]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ExportButtons({
  onCopy,
  onDownload,
}: {
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        onClick={onCopy}
        className="h-10 rounded-lg border border-[#f05a28]/35 px-3 text-sm font-semibold text-[#b74119] transition hover:border-[#f05a28]"
      >
        Copy
      </button>
      <button
        type="button"
        onClick={onDownload}
        className="h-10 rounded-lg bg-[#101828] px-3 text-sm font-semibold text-white transition hover:bg-[#27364a]"
      >
        Export
      </button>
    </div>
  );
}
