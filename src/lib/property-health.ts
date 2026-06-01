import Papa from "papaparse";

export type LedgerCategory =
  | "operating_income"
  | "maintenance"
  | "management_fees"
  | "leasing_fees"
  | "utilities"
  | "legal"
  | "taxes_insurance"
  | "hoa"
  | "owner_contributions"
  | "owner_distributions"
  | "security_deposits_liabilities"
  | "internal_transfers_clearing"
  | "balance_sheet_non_operating"
  | "true_uncategorized";

export type ExcludedSubcategory =
  | "Trust / Liability / Clearing"
  | "Security Deposits / Liabilities"
  | "Internal Transfers / Clearing"
  | "Balance Sheet / Non-operating";

export type MaintenanceSubcategory =
  | "hvac"
  | "plumbing"
  | "roof"
  | "lawn"
  | "appliance"
  | "electrical"
  | "pest"
  | "turnover"
  | "cleaning"
  | "general_repair"
  | "other";

export type RiskLevel = "Low" | "Moderate" | "High";
export type TrendDirection = "Down" | "Flat" | "Up";

export type LedgerRow = {
  id: string;
  date: string;
  month: string;
  property: string;
  account: string;
  description: string;
  memo: string;
  payee: string;
  debit: number;
  credit: number;
  amount: number;
  category: LedgerCategory;
  maintenanceSubcategory: MaintenanceSubcategory | null;
  excludedSubcategory: ExcludedSubcategory | null;
  isOperating: boolean;
  raw: Record<string, string>;
};

export type MonthlyTrend = {
  month: string;
  income: number;
  expenses: number;
  maintenance: number;
};

export type YearOverYearComparison = {
  available: boolean;
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  maintenanceChangePct: number | null;
};

export type AccountSummary = {
  account: string;
  rows: number;
  amount: number;
};

export type TextSummary = {
  label: string;
  rows: number;
  amount: number;
};

export type MaintenanceWatchItem = {
  subcategory: MaintenanceSubcategory;
  label: string;
  amount: number;
  transactionCount: number;
  trendDirection: TrendDirection;
  riskLevel: RiskLevel;
};

export type PropertyHealthReport = {
  propertyName: string;
  rowCount: number;
  operatingRowCount: number;
  excludedRowCount: number;
  dateRange: { start: string | null; end: string | null };
  totals: {
    operatingIncome: number;
    rentIncome: number;
    otherIncomeRecoveries: number;
    operatingExpenses: number;
    maintenanceTotal: number;
    managementFees: number;
    leasingFees: number;
    utilities: number;
    legal: number;
    ownerDistributions: number;
    ownerContributions: number;
    estimatedNoiCashFlow: number;
    trueUncategorized: number;
    excludedNonOperating: number;
    operatingTotal: number;
  };
  categories: Record<LedgerCategory, number>;
  maintenanceSubcategories: Record<MaintenanceSubcategory, number>;
  monthlyTrends: MonthlyTrend[];
  yearOverYear: YearOverYearComparison;
  maintenanceWatchlist: MaintenanceWatchItem[];
  topExcludedAccounts: AccountSummary[];
  topTrueUncategorizedAccounts: AccountSummary[];
  topMaintenanceVendors: TextSummary[];
  topMaintenanceDescriptions: TextSummary[];
  rows: LedgerRow[];
  warnings: string[];
};

const operatingExpenseCategories = new Set<LedgerCategory>([
  "maintenance",
  "management_fees",
  "leasing_fees",
  "utilities",
  "legal",
  "taxes_insurance",
  "hoa",
]);

const excludedCategories = new Set<LedgerCategory>([
  "security_deposits_liabilities",
  "internal_transfers_clearing",
  "balance_sheet_non_operating",
]);

const excludedTrustAccounts = new Set([1150, 1160, 2210, 2250, 2270]);

export const ledgerCategoryLabels: Record<LedgerCategory, string> = {
  operating_income: "Operating Income",
  maintenance: "Maintenance",
  management_fees: "Management Fees",
  leasing_fees: "Leasing Fees",
  utilities: "Utilities",
  legal: "Legal",
  taxes_insurance: "Taxes / Insurance",
  hoa: "HOA",
  owner_contributions: "Owner Contributions",
  owner_distributions: "Owner Distributions",
  security_deposits_liabilities: "Security Deposits / Liabilities",
  internal_transfers_clearing: "Internal Transfers / Clearing",
  balance_sheet_non_operating: "Balance Sheet / Non-operating",
  true_uncategorized: "True Uncategorized",
};

export const maintenanceSubcategoryLabels: Record<MaintenanceSubcategory, string> =
  {
    hvac: "HVAC",
    plumbing: "Plumbing",
    roof: "Roof",
    lawn: "Lawn",
    appliance: "Appliance",
    electrical: "Electrical",
    pest: "Pest",
    turnover: "Turnover",
    cleaning: "Cleaning",
    general_repair: "General Repair",
    other: "Other",
  };

export const maintenanceWatchlistOrder: MaintenanceSubcategory[] = [
  "hvac",
  "plumbing",
  "appliance",
  "lawn",
  "turnover",
  "general_repair",
];

export function parseAppFolioGeneralLedger(csvText: string): PropertyHealthReport {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const warnings = parsed.errors.map(
    (error) => `CSV row ${error.row ?? "unknown"}: ${error.message}`,
  );

  if (!parsed.data.length) {
    throw new Error(
      "No ledger rows were found. Check that the CSV has a header row and exported ledger detail.",
    );
  }

  const rows = parsed.data
    .map((raw, index) => normalizeRow(raw, index))
    .filter((row): row is LedgerRow => Boolean(row));

  if (!rows.length) {
    throw new Error("No usable dated ledger rows were found in the CSV.");
  }

  const categories = makeEmptyCategoryTotals();
  const maintenanceSubcategories = makeEmptyMaintenanceTotals();
  const monthly = new Map<string, MonthlyTrend>();
  let rentIncome = 0;
  let operatingIncome = 0;
  let operatingExpenses = 0;
  let ownerDistributions = 0;
  let ownerContributions = 0;
  let excludedNonOperating = 0;

  for (const row of rows) {
    const value = Math.abs(row.amount);
    categories[row.category] += value;

    if (row.category === "operating_income") {
      operatingIncome += value;
      if (isRentIncome(row)) {
        rentIncome += value;
      }
    }

    if (operatingExpenseCategories.has(row.category)) {
      operatingExpenses += value;
    }

    if (row.category === "owner_distributions") {
      ownerDistributions += value;
    }

    if (row.category === "owner_contributions") {
      ownerContributions += value;
    }

    if (excludedCategories.has(row.category)) {
      excludedNonOperating += value;
    }

    if (row.maintenanceSubcategory && row.category === "maintenance") {
      maintenanceSubcategories[row.maintenanceSubcategory] += value;
    }

    const month = getMonthlyBucket(monthly, row.month);
    if (row.category === "operating_income") {
      month.income += value;
    } else if (operatingExpenseCategories.has(row.category)) {
      month.expenses += value;
    }

    if (row.category === "maintenance") {
      month.maintenance += value;
    }
  }

  const sortedRows = rows.sort((a, b) => a.date.localeCompare(b.date));
  const monthlyTrends = [...monthly.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const operatingTotal = operatingIncome + operatingExpenses;

  return {
    propertyName: inferPropertyName(rows),
    rowCount: rows.length,
    operatingRowCount: rows.filter((row) => row.isOperating).length,
    excludedRowCount: rows.filter((row) => excludedCategories.has(row.category))
      .length,
    dateRange: {
      start: sortedRows[0]?.date ?? null,
      end: sortedRows[sortedRows.length - 1]?.date ?? null,
    },
    totals: {
      operatingIncome,
      rentIncome,
      otherIncomeRecoveries: operatingIncome - rentIncome,
      operatingExpenses,
      maintenanceTotal: categories.maintenance,
      managementFees: categories.management_fees,
      leasingFees: categories.leasing_fees,
      utilities: categories.utilities,
      legal: categories.legal,
      ownerDistributions,
      ownerContributions,
      estimatedNoiCashFlow: operatingIncome - operatingExpenses,
      trueUncategorized: categories.true_uncategorized,
      excludedNonOperating,
      operatingTotal,
    },
    categories,
    maintenanceSubcategories,
    monthlyTrends,
    yearOverYear: calculateYearOverYear(monthlyTrends),
    maintenanceWatchlist: buildMaintenanceWatchlist(rows, monthlyTrends),
    topExcludedAccounts: summarizeAccounts(
      rows.filter((row) => excludedCategories.has(row.category)),
      8,
    ),
    topTrueUncategorizedAccounts: summarizeAccounts(
      rows.filter((row) => row.category === "true_uncategorized"),
      8,
    ),
    topMaintenanceVendors: summarizeText(
      rows.filter((row) => row.category === "maintenance"),
      (row) => row.payee || "Unknown vendor",
      8,
    ),
    topMaintenanceDescriptions: summarizeText(
      rows.filter((row) => row.category === "maintenance"),
      (row) => row.description || row.memo || row.account || "No description",
      8,
    ),
    rows,
    warnings,
  };
}

function normalizeRow(
  raw: Record<string, string>,
  index: number,
): LedgerRow | null {
  const date = parseDate(getField(raw, ["date", "transaction date", "posted date"]));

  if (!date) {
    return null;
  }

  const account = getField(raw, ["account", "gl account", "account name"]);
  const description = getField(raw, [
    "description",
    "transaction description",
    "details",
  ]);
  const memo = getField(raw, ["memo", "remarks", "notes"]);
  const payee = getField(raw, [
    "payee",
    "payee / payer",
    "name",
    "vendor",
    "tenant",
  ]);
  const property = getField(raw, [
    "property",
    "property name",
    "property address",
    "building",
  ]);
  const debit = parseCurrency(getField(raw, ["debit", "debits"]));
  const credit = parseCurrency(getField(raw, ["credit", "credits"]));
  const explicitAmount = parseCurrency(
    getField(raw, ["amount", "net amount", "transaction amount"]),
  );
  const amount = debit || credit ? credit - debit : explicitAmount;
  const classification = categorizeLedgerRow(account, description, memo, payee);
  const maintenanceSubcategory =
    classification.category === "maintenance"
      ? categorizeMaintenance(account, description, memo, payee)
      : null;

  return {
    id: `${date}-${index}`,
    date,
    month: date.slice(0, 7),
    property,
    account,
    description,
    memo,
    payee,
    debit,
    credit,
    amount: amount || 0,
    category: classification.category,
    maintenanceSubcategory,
    excludedSubcategory: classification.excludedSubcategory,
    isOperating:
      classification.category === "operating_income" ||
      operatingExpenseCategories.has(classification.category),
    raw,
  };
}

function categorizeLedgerRow(
  account: string,
  description: string,
  memo: string,
  payee: string,
): { category: LedgerCategory; excludedSubcategory: ExcludedSubcategory | null } {
  const text = `${account} ${description} ${memo} ${payee}`.toLowerCase();
  const accountCode = getAccountCode(account);

  if (accountCode && excludedTrustAccounts.has(accountCode)) {
    const category =
      accountCode === 2250
        ? "security_deposits_liabilities"
        : accountCode === 2270
          ? "internal_transfers_clearing"
          : "balance_sheet_non_operating";

    return {
      category,
      excludedSubcategory: "Trust / Liability / Clearing",
    };
  }

  if (accountCode) {
    if (accountCode >= 1000 && accountCode < 2000) {
      return {
        category: "balance_sheet_non_operating",
        excludedSubcategory: "Balance Sheet / Non-operating",
      };
    }

    if (accountCode >= 2000 && accountCode < 3000) {
      return {
        category: text.includes("security deposit")
          ? "security_deposits_liabilities"
          : "balance_sheet_non_operating",
        excludedSubcategory: text.includes("security deposit")
          ? "Security Deposits / Liabilities"
          : "Balance Sheet / Non-operating",
      };
    }

    if (accountCode >= 3200 && accountCode < 3300) {
      return { category: "owner_contributions", excludedSubcategory: null };
    }

    if (accountCode >= 3400 && accountCode < 3500) {
      return { category: "owner_distributions", excludedSubcategory: null };
    }

    if (accountCode >= 4000 && accountCode < 6000) {
      return { category: "operating_income", excludedSubcategory: null };
    }

    if (accountCode === 6300) {
      return { category: "management_fees", excludedSubcategory: null };
    }

    if (accountCode === 6720 || accountCode === 6730) {
      return { category: "leasing_fees", excludedSubcategory: null };
    }

    if (accountCode === 6445) {
      return { category: "utilities", excludedSubcategory: null };
    }

    if (accountCode >= 6240 && accountCode < 6290) {
      return { category: "maintenance", excludedSubcategory: null };
    }

    if (accountCode === 6210 || accountCode === 6670 || accountCode === 6611) {
      return { category: "maintenance", excludedSubcategory: null };
    }

    if (accountCode >= 7600 && accountCode < 7700) {
      return { category: "legal", excludedSubcategory: null };
    }

    if (accountCode >= 6000 && accountCode < 8000) {
      return { category: "maintenance", excludedSubcategory: null };
    }
  }

  if (matches(text, ["security deposit", "deposit clearing"])) {
    return {
      category: "security_deposits_liabilities",
      excludedSubcategory: "Security Deposits / Liabilities",
    };
  }

  if (matches(text, ["clearing", "transfer", "owner rent account", "escrow", "prepaid rent"])) {
    return {
      category: "internal_transfers_clearing",
      excludedSubcategory: "Internal Transfers / Clearing",
    };
  }

  if (matches(text, ["owner draw", "owner distribution", "owner disbursement", "owner payment"])) {
    return { category: "owner_distributions", excludedSubcategory: null };
  }

  if (matches(text, ["owner contribution", "owner deposit", "owner advance", "capital contribution"])) {
    return { category: "owner_contributions", excludedSubcategory: null };
  }

  if (matches(text, ["management fee", "mgmt fee", "pm fee"])) {
    return { category: "management_fees", excludedSubcategory: null };
  }

  if (matches(text, ["leasing fee", "lease fee", "tenant placement", "renewal fee"])) {
    return { category: "leasing_fees", excludedSubcategory: null };
  }

  if (matches(text, ["utility", "electric", "water", "sewer", "gas", "trash", "garbage", "internet"])) {
    return { category: "utilities", excludedSubcategory: null };
  }

  if (matches(text, ["legal", "attorney", "eviction", "court", "filing fee"])) {
    return { category: "legal", excludedSubcategory: null };
  }

  if (matches(text, ["repair", "maintenance", "work order", "service call", "vendor"])) {
    return { category: "maintenance", excludedSubcategory: null };
  }

  if (matches(text, ["rent", "income", "reimbursement", "recovery", "late fee", "pet fee", "application fee"])) {
    return { category: "operating_income", excludedSubcategory: null };
  }

  return { category: "true_uncategorized", excludedSubcategory: null };
}

function categorizeMaintenance(
  account: string,
  description: string,
  memo: string,
  payee: string,
): MaintenanceSubcategory {
  const text = `${account} ${description} ${memo} ${payee}`.toLowerCase();

  if (matches(text, ["hvac", "air conditioner", "a/c", "ac unit", "heat pump", "furnace"])) return "hvac";
  if (matches(text, ["plumb", "toilet", "sink", "faucet", "drain", "sewer", "pipe", "water heater"])) return "plumbing";
  if (matches(text, ["roof", "shingle", "gutter", "soffit"])) return "roof";
  if (matches(text, ["lawn", "landscape", "yard", "grass", "mow", "tree", "irrigation"])) return "lawn";
  if (matches(text, ["appliance", "fridge", "refrigerator", "range", "oven", "dishwasher", "washer", "dryer", "microwave"])) return "appliance";
  if (matches(text, ["electric", "breaker", "outlet", "wiring", "light fixture", "ceiling fan"])) return "electrical";
  if (matches(text, ["pest", "termite", "roach", "rodent", "bug"])) return "pest";
  if (matches(text, ["turn", "turnover", "move out", "make ready", "paint", "flooring", "carpet"])) return "turnover";
  if (matches(text, ["clean", "maid", "janitorial", "trash out"])) return "cleaning";
  if (matches(text, ["repair", "handyman", "maintenance", "service call"])) return "general_repair";

  return "other";
}

function buildMaintenanceWatchlist(
  rows: LedgerRow[],
  monthlyTrends: MonthlyTrend[],
): MaintenanceWatchItem[] {
  return maintenanceWatchlistOrder.map((subcategory) => {
    const matchingRows = rows.filter(
      (row) =>
        row.category === "maintenance" &&
        row.maintenanceSubcategory === subcategory,
    );
    const amount = matchingRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
    const trendDirection = getMaintenanceSubcategoryTrend(rows, subcategory);
    const share =
      amount /
      Math.max(
        monthlyTrends.reduce((sum, month) => sum + month.maintenance, 0),
        1,
      );
    const riskLevel: RiskLevel =
      trendDirection === "Up" && (amount >= 2500 || share >= 0.2)
        ? "High"
        : amount >= 1000 || matchingRows.length >= 4 || trendDirection === "Up"
          ? "Moderate"
          : "Low";

    return {
      subcategory,
      label: maintenanceSubcategoryLabels[subcategory],
      amount,
      transactionCount: matchingRows.length,
      trendDirection,
      riskLevel,
    };
  });
}

function getMaintenanceSubcategoryTrend(
  rows: LedgerRow[],
  subcategory: MaintenanceSubcategory,
): TrendDirection {
  const months = [
    ...new Set(rows.map((row) => row.month).filter(Boolean)),
  ].sort();

  if (months.length < 4) {
    return "Flat";
  }

  const currentMonths = new Set(months.slice(-3));
  const priorMonths = new Set(months.slice(-6, -3));
  const current = rows
    .filter(
      (row) =>
        row.category === "maintenance" &&
        row.maintenanceSubcategory === subcategory &&
        currentMonths.has(row.month),
    )
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const prior = rows
    .filter(
      (row) =>
        row.category === "maintenance" &&
        row.maintenanceSubcategory === subcategory &&
        priorMonths.has(row.month),
    )
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);

  if (current > prior * 1.15 && current - prior > 100) {
    return "Up";
  }

  if (current < prior * 0.85 && prior - current > 100) {
    return "Down";
  }

  return "Flat";
}

function calculateYearOverYear(monthlyTrends: MonthlyTrend[]): YearOverYearComparison {
  if (monthlyTrends.length < 13) {
    return {
      available: false,
      currentPeriodLabel: "Need at least 13 months",
      priorPeriodLabel: "Unavailable",
      incomeChangePct: null,
      expenseChangePct: null,
      maintenanceChangePct: null,
    };
  }

  const current = monthlyTrends.slice(-12);
  const prior = monthlyTrends.slice(-24, -12);

  if (prior.length < 12) {
    return {
      available: false,
      currentPeriodLabel: "Need 24 months for a full comparison",
      priorPeriodLabel: "Unavailable",
      incomeChangePct: null,
      expenseChangePct: null,
      maintenanceChangePct: null,
    };
  }

  return {
    available: true,
    currentPeriodLabel: `${current[0].month} to ${current[current.length - 1].month}`,
    priorPeriodLabel: `${prior[0].month} to ${prior[prior.length - 1].month}`,
    incomeChangePct: percentChange(sumTrend(current, "income"), sumTrend(prior, "income")),
    expenseChangePct: percentChange(sumTrend(current, "expenses"), sumTrend(prior, "expenses")),
    maintenanceChangePct: percentChange(sumTrend(current, "maintenance"), sumTrend(prior, "maintenance")),
  };
}

function isRentIncome(row: LedgerRow): boolean {
  const text = `${row.account} ${row.description} ${row.memo}`.toLowerCase();
  return (
    matches(text, ["rent", "rental income"]) &&
    !matches(text, ["late fee", "pet fee", "application", "reimbursement", "recovery"])
  );
}

function summarizeAccounts(rows: LedgerRow[], limit: number): AccountSummary[] {
  const summaries = new Map<string, AccountSummary>();

  for (const row of rows) {
    const account = row.account || "No GL account";
    const current = summaries.get(account) ?? { account, rows: 0, amount: 0 };
    current.rows += 1;
    current.amount += Math.abs(row.amount);
    summaries.set(account, current);
  }

  return [...summaries.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function summarizeText(
  rows: LedgerRow[],
  labelForRow: (row: LedgerRow) => string,
  limit: number,
): TextSummary[] {
  const summaries = new Map<string, TextSummary>();

  for (const row of rows) {
    const label = labelForRow(row).trim() || "Unknown";
    const current = summaries.get(label) ?? { label, rows: 0, amount: 0 };
    current.rows += 1;
    current.amount += Math.abs(row.amount);
    summaries.set(label, current);
  }

  return [...summaries.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function getField(raw: Record<string, string>, candidates: string[]): string {
  const normalized = new Map(
    Object.entries(raw).map(([key, value]) => [
      key.trim().toLowerCase(),
      String(value ?? "").trim(),
    ]),
  );

  for (const candidate of candidates) {
    const value = normalized.get(candidate);
    if (value) {
      return value;
    }
  }

  return "";
}

function parseCurrency(value: string): number {
  if (!value) {
    return 0;
  }

  const isNegative = value.includes("(") && value.includes(")");
  const cleaned = value.replace(/[$,\s()]/g, "");
  const parsed = Number(cleaned);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return isNegative ? -Math.abs(parsed) : parsed;
}

function parseDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function inferPropertyName(rows: LedgerRow[]): string {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.property) {
      counts.set(row.property, (counts.get(row.property) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Uploaded property";
}

function makeEmptyCategoryTotals(): Record<LedgerCategory, number> {
  return {
    operating_income: 0,
    maintenance: 0,
    management_fees: 0,
    leasing_fees: 0,
    utilities: 0,
    legal: 0,
    taxes_insurance: 0,
    hoa: 0,
    owner_contributions: 0,
    owner_distributions: 0,
    security_deposits_liabilities: 0,
    internal_transfers_clearing: 0,
    balance_sheet_non_operating: 0,
    true_uncategorized: 0,
  };
}

function makeEmptyMaintenanceTotals(): Record<MaintenanceSubcategory, number> {
  return {
    hvac: 0,
    plumbing: 0,
    roof: 0,
    lawn: 0,
    appliance: 0,
    electrical: 0,
    pest: 0,
    turnover: 0,
    cleaning: 0,
    general_repair: 0,
    other: 0,
  };
}

function getMonthlyBucket(
  monthly: Map<string, MonthlyTrend>,
  month: string,
): MonthlyTrend {
  const existing = monthly.get(month);
  if (existing) {
    return existing;
  }

  const next = { month, income: 0, expenses: 0, maintenance: 0 };
  monthly.set(month, next);
  return next;
}

function sumTrend(
  rows: MonthlyTrend[],
  key: keyof Omit<MonthlyTrend, "month">,
): number {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function percentChange(current: number, prior: number): number | null {
  if (prior === 0) {
    return null;
  }

  return ((current - prior) / prior) * 100;
}

function matches(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function getAccountCode(account: string): number | null {
  const match = account.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}
