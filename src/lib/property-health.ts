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
  | "excluded_non_operating"
  | "true_uncategorized";

export type MaintenanceSubcategory =
  | "hvac"
  | "plumbing"
  | "appliance"
  | "lawn"
  | "turnover"
  | "general_repair"
  | "roof"
  | "electrical"
  | "pest"
  | "cleaning"
  | "other";

export type RiskLevel = "Low" | "Watch" | "Escalating";
export type TrendDirection = "Down" | "Flat" | "Up" | "Not enough data";

export type GLAccountMapping = {
  glNumber: number;
  glName: string;
  category: LedgerCategory;
  subcategory: string;
  includeInOperatingTotals: boolean;
  includeInHealthScore: boolean;
  includeInAiAnalysis: boolean;
};

export type LedgerRow = {
  id: string;
  date: string;
  month: string;
  propertyAddress: string;
  propertyId: string;
  unit: string;
  unitId: string;
  owner: string;
  account: string;
  glNumber: number | null;
  glName: string;
  description: string;
  memo: string;
  payee: string;
  debit: number;
  credit: number;
  amount: number;
  category: LedgerCategory;
  subcategory: string;
  maintenanceSubcategory: MaintenanceSubcategory | null;
  includeInOperatingTotals: boolean;
  includeInHealthScore: boolean;
  includeInAiAnalysis: boolean;
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
  glNumber: number | null;
  glName: string;
  rows: number;
  amount: number;
};

export type TextSummary = {
  label: string;
  rows: number;
  amount: number;
};

export type MaintenanceTransaction = {
  id: string;
  date: string;
  account: string;
  vendorPayee: string;
  description: string;
  amount: number;
  propertyAddress: string;
  unit: string;
  propertyId: string;
  unitId: string;
};

export type MaintenanceWatchItem = {
  subcategory: MaintenanceSubcategory;
  label: string;
  amount: number;
  transactionCount: number;
  averageTransactionAmount: number;
  latestTransactionDate: string | null;
  trendDirection: TrendDirection;
  trendBasis: "MoM" | "QoQ" | "Not enough data";
  riskLevel: RiskLevel;
  transactions: MaintenanceTransaction[];
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
  portfolioMetadata: {
    propertyAddresses: string[];
    units: string[];
    propertyIds: string[];
    unitIds: string[];
    owners: string[];
  };
  rows: LedgerRow[];
  warnings: string[];
};

const excludedSubcategory = "Trust / Liability / Clearing";

export const explicitGLMappings: Record<number, GLAccountMapping> = {
  1150: excludedMapping(1150, "Owner Rent Account"),
  1160: excludedMapping(1160, "Escrow Account"),
  2210: excludedMapping(2210, "Prepaid Rent"),
  2250: excludedMapping(2250, "Security Deposits"),
  2270: excludedMapping(2270, "Security Deposits Clearing"),
  3200: operatingMapping(3200, "Owner Contribution", "owner_contributions", "Owner Activity", false),
  3400: operatingMapping(3400, "Owner Distribution", "owner_distributions", "Owner Activity", false),
  4100: operatingMapping(4100, "Rent Income", "operating_income", "Rent Income", true),
  4101: operatingMapping(4101, "Pet Rent", "operating_income", "Other Income / Recoveries", true),
  4470: operatingMapping(4470, "Pet Fee-Non Refundable", "operating_income", "Other Income / Recoveries", true),
  4550: operatingMapping(4550, "Application Fee Income", "operating_income", "Other Income / Recoveries", true),
  5620: operatingMapping(5620, "Lease Prep fees", "operating_income", "Other Income / Recoveries", true),
  5622: operatingMapping(5622, "Lease renewal fee", "operating_income", "Other Income / Recoveries", true),
  5650: operatingMapping(5650, "Move Out Charges", "operating_income", "Other Income / Recoveries", true),
  5680: operatingMapping(5680, "Late Fee", "operating_income", "Other Income / Recoveries", true),
  5683: operatingMapping(5683, "3 Day Notice", "operating_income", "Other Income / Recoveries", true),
  5686: operatingMapping(5686, "Utilities Reimbursement", "operating_income", "Other Income / Recoveries", true),
  6150: operatingMapping(6150, "Certified mail", "legal", "Legal / Notices", true),
  6210: operatingMapping(6210, "Repair & Maintenance", "maintenance", "General Repair", true),
  6240: operatingMapping(6240, "HVAC", "maintenance", "HVAC", true),
  6241: operatingMapping(6241, "Appliance", "maintenance", "Appliance", true),
  6244: operatingMapping(6244, "Plumbing", "maintenance", "Plumbing", true),
  6261: operatingMapping(6261, "Lawn Maintenance", "maintenance", "Lawn", true),
  6280: operatingMapping(6280, "Maintenance Fees", "maintenance", "General Repair", true),
  6300: operatingMapping(6300, "Management Fees", "management_fees", "Management Fees", true),
  6445: operatingMapping(6445, "Utilities", "utilities", "Utilities", true),
  6611: operatingMapping(6611, "Maintenance-Materials", "maintenance", "General Repair", true),
  6670: operatingMapping(6670, "Appliances", "maintenance", "Appliance", true),
  6720: operatingMapping(6720, "New Move In Leasing Fee", "leasing_fees", "Leasing Fees", true),
  6730: operatingMapping(6730, "Annual Renewal Fee", "leasing_fees", "Leasing Fees", true),
  7611: operatingMapping(7611, "Eviction Services, Costs & Fees", "legal", "Legal", true),
};

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
  excluded_non_operating: "Excluded / Non-operating",
  true_uncategorized: "True Uncategorized",
};

export const maintenanceSubcategoryLabels: Record<MaintenanceSubcategory, string> =
  {
    hvac: "HVAC",
    plumbing: "Plumbing",
    appliance: "Appliance",
    lawn: "Lawn",
    turnover: "Turnover",
    general_repair: "General Repair",
    roof: "Roof",
    electrical: "Electrical",
    pest: "Pest",
    cleaning: "Cleaning",
    other: "Other",
  };

export const maintenanceWatchlistOrder: MaintenanceSubcategory[] = [
  "hvac",
  "plumbing",
  "appliance",
  "lawn",
  "turnover",
  "general_repair",
  "roof",
  "electrical",
  "pest",
  "cleaning",
  "other",
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

    if (row.category === "operating_income" && row.includeInOperatingTotals) {
      operatingIncome += value;
      if (isRentIncome(row)) {
        rentIncome += value;
      }
    }

    if (isOperatingExpense(row)) {
      operatingExpenses += value;
    }

    if (row.category === "owner_distributions") {
      ownerDistributions += value;
    }

    if (row.category === "owner_contributions") {
      ownerContributions += value;
    }

    if (row.category === "excluded_non_operating") {
      excludedNonOperating += value;
    }

    if (row.maintenanceSubcategory && row.category === "maintenance") {
      maintenanceSubcategories[row.maintenanceSubcategory] += value;
    }

    const month = getMonthlyBucket(monthly, row.month);
    if (row.category === "operating_income" && row.includeInOperatingTotals) {
      month.income += value;
    } else if (isOperatingExpense(row)) {
      month.expenses += value;
    }

    if (row.category === "maintenance" && row.includeInOperatingTotals) {
      month.maintenance += value;
    }
  }

  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const monthlyTrends = [...monthly.values()].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const operatingTotal = operatingIncome + operatingExpenses;

  return {
    propertyName: inferPropertyName(rows),
    rowCount: rows.length,
    operatingRowCount: rows.filter((row) => row.includeInOperatingTotals).length,
    excludedRowCount: rows.filter((row) => row.category === "excluded_non_operating")
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
    maintenanceWatchlist: buildMaintenanceWatchlist(rows),
    topExcludedAccounts: summarizeAccounts(
      rows.filter((row) => row.category === "excluded_non_operating"),
      12,
    ),
    topTrueUncategorizedAccounts: summarizeAccounts(
      rows.filter((row) => row.category === "true_uncategorized"),
      12,
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
    portfolioMetadata: buildPortfolioMetadata(rows),
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
  const parsedAccount = parseGLAccount(account);
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
  const propertyAddress = getField(raw, [
    "property address",
    "property",
    "property name",
    "building",
  ]);
  const debit = parseCurrency(getField(raw, ["debit", "debits"]));
  const credit = parseCurrency(getField(raw, ["credit", "credits"]));
  const explicitAmount = parseCurrency(
    getField(raw, ["amount", "net amount", "transaction amount"]),
  );
  const amount = debit || credit ? credit - debit : explicitAmount;
  const mapping = getGLAccountMapping(
    parsedAccount.glNumber,
    parsedAccount.glName,
    account,
    description,
    memo,
    payee,
  );
  const maintenanceSubcategory =
    mapping.category === "maintenance"
      ? mapMaintenanceSubcategory(mapping.subcategory, account, description, memo, payee)
      : null;

  return {
    id: `${date}-${index}`,
    date,
    month: date.slice(0, 7),
    propertyAddress,
    propertyId: getField(raw, ["property id", "property_id"]),
    unit: getField(raw, ["unit", "unit name", "unit address"]),
    unitId: getField(raw, ["unit id", "unit_id"]),
    owner: getField(raw, ["owner", "owner name"]),
    account,
    glNumber: parsedAccount.glNumber,
    glName: parsedAccount.glName,
    description,
    memo,
    payee,
    debit,
    credit,
    amount: amount || 0,
    category: mapping.category,
    subcategory: mapping.subcategory,
    maintenanceSubcategory,
    includeInOperatingTotals: mapping.includeInOperatingTotals,
    includeInHealthScore: mapping.includeInHealthScore,
    includeInAiAnalysis: mapping.includeInAiAnalysis,
    raw,
  };
}

function getGLAccountMapping(
  glNumber: number | null,
  glName: string,
  account: string,
  description: string,
  memo: string,
  payee: string,
): GLAccountMapping {
  if (glNumber) {
    const exact = explicitGLMappings[glNumber];
    if (exact) {
      return exact;
    }

    const parent = explicitGLMappings[Math.floor(glNumber)];
    if (parent) {
      return { ...parent, glNumber, glName: glName || parent.glName };
    }

    if (glNumber >= 1000 && glNumber < 3000) {
      return excludedMapping(glNumber, glName || account || "Balance Sheet Account");
    }

    if (glNumber >= 4000 && glNumber < 6000) {
      return operatingMapping(
        glNumber,
        glName || account,
        "operating_income",
        "Other Income / Recoveries",
        true,
      );
    }
  }

  const text = `${account} ${description} ${memo} ${payee}`.toLowerCase();

  if (matches(text, ["security deposit", "owner rent account", "prepaid rent", "escrow", "clearing"])) {
    return excludedMapping(glNumber ?? 0, glName || account || "Excluded Account");
  }

  if (matches(text, ["repair", "maintenance", "work order", "service call", "vendor"])) {
    return operatingMapping(glNumber ?? 0, glName || account || "Maintenance", "maintenance", "General Repair", true);
  }

  if (matches(text, ["rent", "income", "reimbursement", "recovery", "late fee", "pet fee", "application fee"])) {
    return operatingMapping(glNumber ?? 0, glName || account || "Income", "operating_income", "Other Income / Recoveries", true);
  }

  return {
    glNumber: glNumber ?? 0,
    glName: glName || account || "Unmapped Account",
    category: "true_uncategorized",
    subcategory: "Unmapped GL Account",
    includeInOperatingTotals: false,
    includeInHealthScore: false,
    includeInAiAnalysis: false,
  };
}

function buildMaintenanceWatchlist(rows: LedgerRow[]): MaintenanceWatchItem[] {
  return maintenanceWatchlistOrder.map((subcategory) => {
    const matchingRows = rows
      .filter(
        (row) =>
          row.category === "maintenance" &&
          row.maintenanceSubcategory === subcategory &&
          row.includeInOperatingTotals,
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    const amount = matchingRows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
    const transactionCount = matchingRows.length;
    const averageTransactionAmount =
      transactionCount > 0 ? amount / transactionCount : 0;
    const trend = getMaintenanceSubcategoryTrend(rows, subcategory);
    const riskLevel = getMaintenanceRisk(amount, transactionCount, trend.direction);

    return {
      subcategory,
      label: maintenanceSubcategoryLabels[subcategory],
      amount,
      transactionCount,
      averageTransactionAmount,
      latestTransactionDate: matchingRows[0]?.date ?? null,
      trendDirection: trend.direction,
      trendBasis: trend.basis,
      riskLevel,
      transactions: matchingRows.map((row) => ({
        id: row.id,
        date: row.date,
        account: row.account,
        vendorPayee: row.payee,
        description: row.description || row.memo,
        amount: Math.abs(row.amount),
        propertyAddress: row.propertyAddress,
        unit: row.unit,
        propertyId: row.propertyId,
        unitId: row.unitId,
      })),
    };
  });
}

function getMaintenanceSubcategoryTrend(
  rows: LedgerRow[],
  subcategory: MaintenanceSubcategory,
): { direction: TrendDirection; basis: "MoM" | "QoQ" | "Not enough data" } {
  const months = [...new Set(rows.map((row) => row.month).filter(Boolean))].sort();

  if (months.length >= 6) {
    const currentMonths = new Set(months.slice(-3));
    const priorMonths = new Set(months.slice(-6, -3));
    return {
      direction: comparePeriods(rows, subcategory, currentMonths, priorMonths),
      basis: "QoQ",
    };
  }

  if (months.length >= 2) {
    const currentMonths = new Set(months.slice(-1));
    const priorMonths = new Set(months.slice(-2, -1));
    return {
      direction: comparePeriods(rows, subcategory, currentMonths, priorMonths),
      basis: "MoM",
    };
  }

  return { direction: "Not enough data", basis: "Not enough data" };
}

function comparePeriods(
  rows: LedgerRow[],
  subcategory: MaintenanceSubcategory,
  currentMonths: Set<string>,
  priorMonths: Set<string>,
): TrendDirection {
  const current = sumMaintenanceForMonths(rows, subcategory, currentMonths);
  const prior = sumMaintenanceForMonths(rows, subcategory, priorMonths);

  if (current === 0 && prior === 0) {
    return "Flat";
  }

  if (prior === 0 && current > 0) {
    return "Up";
  }

  if (current > prior * 1.15 && current - prior > 100) {
    return "Up";
  }

  if (current < prior * 0.85 && prior - current > 100) {
    return "Down";
  }

  return "Flat";
}

function sumMaintenanceForMonths(
  rows: LedgerRow[],
  subcategory: MaintenanceSubcategory,
  months: Set<string>,
): number {
  return rows
    .filter(
      (row) =>
        row.category === "maintenance" &&
        row.maintenanceSubcategory === subcategory &&
        row.includeInOperatingTotals &&
        months.has(row.month),
    )
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);
}

function getMaintenanceRisk(
  amount: number,
  transactionCount: number,
  trendDirection: TrendDirection,
): RiskLevel {
  if (trendDirection === "Up" && (amount >= 2500 || transactionCount >= 4)) {
    return "Escalating";
  }

  if (amount >= 1500 || transactionCount >= 4 || trendDirection === "Up") {
    return "Watch";
  }

  return "Low";
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

function isOperatingExpense(row: LedgerRow): boolean {
  return (
    row.includeInOperatingTotals &&
    [
      "maintenance",
      "management_fees",
      "leasing_fees",
      "utilities",
      "legal",
      "taxes_insurance",
      "hoa",
    ].includes(row.category)
  );
}

function mapMaintenanceSubcategory(
  mappedSubcategory: string,
  account: string,
  description: string,
  memo: string,
  payee: string,
): MaintenanceSubcategory {
  const mapped = mappedSubcategory.toLowerCase();

  if (mapped.includes("hvac")) return "hvac";
  if (mapped.includes("plumbing")) return "plumbing";
  if (mapped.includes("appliance")) return "appliance";
  if (mapped.includes("lawn")) return "lawn";
  if (mapped.includes("turnover")) return "turnover";
  if (mapped.includes("roof")) return "roof";
  if (mapped.includes("electrical")) return "electrical";
  if (mapped.includes("pest")) return "pest";
  if (mapped.includes("cleaning")) return "cleaning";

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

function summarizeAccounts(rows: LedgerRow[], limit: number): AccountSummary[] {
  const summaries = new Map<string, AccountSummary>();

  for (const row of rows) {
    const account = row.account || "No GL account";
    const current = summaries.get(account) ?? {
      account,
      glNumber: row.glNumber,
      glName: row.glName,
      rows: 0,
      amount: 0,
    };
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

function buildPortfolioMetadata(rows: LedgerRow[]) {
  return {
    propertyAddresses: uniqueValues(rows.map((row) => row.propertyAddress)),
    units: uniqueValues(rows.map((row) => row.unit)),
    propertyIds: uniqueValues(rows.map((row) => row.propertyId)),
    unitIds: uniqueValues(rows.map((row) => row.unitId)),
    owners: uniqueValues(rows.map((row) => row.owner)),
  };
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
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

function parseGLAccount(account: string): { glNumber: number | null; glName: string } {
  const match = account.match(/^(\d{4})(?:-\d+)?\s*-\s*(.+)$/);

  if (match) {
    return { glNumber: Number(match[1]), glName: match[2].trim() };
  }

  const numberOnly = account.match(/^(\d{4})/);
  return {
    glNumber: numberOnly ? Number(numberOnly[1]) : null,
    glName: account.replace(/^(\d{4})(?:-\d+)?\s*-\s*/, "").trim(),
  };
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
    if (row.propertyAddress) {
      counts.set(row.propertyAddress, (counts.get(row.propertyAddress) ?? 0) + 1);
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
    excluded_non_operating: 0,
    true_uncategorized: 0,
  };
}

function makeEmptyMaintenanceTotals(): Record<MaintenanceSubcategory, number> {
  return {
    hvac: 0,
    plumbing: 0,
    appliance: 0,
    lawn: 0,
    turnover: 0,
    general_repair: 0,
    roof: 0,
    electrical: 0,
    pest: 0,
    cleaning: 0,
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

function excludedMapping(glNumber: number, glName: string): GLAccountMapping {
  return {
    glNumber,
    glName,
    category: "excluded_non_operating",
    subcategory: excludedSubcategory,
    includeInOperatingTotals: false,
    includeInHealthScore: false,
    includeInAiAnalysis: false,
  };
}

function operatingMapping(
  glNumber: number,
  glName: string,
  category: LedgerCategory,
  subcategory: string,
  includeInHealthScore: boolean,
): GLAccountMapping {
  return {
    glNumber,
    glName,
    category,
    subcategory,
    includeInOperatingTotals:
      category !== "owner_contributions" && category !== "owner_distributions",
    includeInHealthScore,
    includeInAiAnalysis: includeInHealthScore,
  };
}
