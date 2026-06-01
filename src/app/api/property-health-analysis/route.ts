import { NextResponse } from "next/server";
import type { PropertyHealthReport } from "@/lib/property-health";

export const runtime = "nodejs";

type AnalysisRequest = {
  report: PropertyHealthReport;
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overallHealthScore",
    "maintenanceTrendScore",
    "risingCostAlerts",
    "recurringIssueDetection",
    "ownerFacingSummary",
    "internalTgpmActionPlan",
  ],
  properties: {
    overallHealthScore: { type: "number", minimum: 0, maximum: 100 },
    maintenanceTrendScore: { type: "number", minimum: 0, maximum: 100 },
    risingCostAlerts: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    recurringIssueDetection: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    ownerFacingSummary: { type: "string" },
    internalTgpmActionPlan: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
  },
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as AnalysisRequest;

    if (!body.report?.rowCount) {
      return NextResponse.json(
        { error: "A calculated property health report is required." },
        { status: 400 },
      );
    }

    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const payload = buildModelPayload(body.report);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are an expert property management maintenance and financial analyst for TG Property Management. Analyze only the clean calculated operating data supplied by the app. Do not invent numbers, vendors, dates, properties, or transactions. Excluded trust, liability, clearing, deposit, and balance sheet activity is context only and must not influence health scores. Focus on catching rising maintenance costs early while keeping owner-facing language polished, clear, and non-alarming.",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "property_health_analysis",
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `OpenAI analysis failed: ${summarizeOpenAiError(errorText)}` },
        { status: response.status },
      );
    }

    const result = await response.json();
    const outputText = extractOutputText(result);

    if (!outputText) {
      return NextResponse.json(
        { error: "OpenAI returned an empty analysis." },
        { status: 502 },
      );
    }

    return NextResponse.json({ analysis: JSON.parse(outputText) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected analysis error.",
      },
      { status: 500 },
    );
  }
}

function buildModelPayload(report: PropertyHealthReport) {
  return {
    instruction:
      "Return structured JSON. Scores and alerts must use only operating income, operating expenses, maintenance subcategories, monthly trends, year-over-year changes, and maintenance vendor/description summaries. Excluded totals and true uncategorized summaries are for data-quality context only.",
    propertyAddress: report.propertyName,
    dateRange: report.dateRange,
    rowCounts: {
      totalRows: report.rowCount,
      operatingRows: report.operatingRowCount,
      excludedRows: report.excludedRowCount,
    },
    incomeTotals: {
      operatingIncome: report.totals.operatingIncome,
      rentIncome: report.totals.rentIncome,
      otherIncomeRecoveries: report.totals.otherIncomeRecoveries,
    },
    expenseTotals: {
      operatingExpenses: report.totals.operatingExpenses,
      maintenanceTotal: report.totals.maintenanceTotal,
      managementFees: report.totals.managementFees,
      leasingFees: report.totals.leasingFees,
      utilities: report.totals.utilities,
      legal: report.totals.legal,
      estimatedNoiCashFlow: report.totals.estimatedNoiCashFlow,
    },
    maintenanceSubcategories: report.maintenanceSubcategories,
    maintenanceWatchlist: report.maintenanceWatchlist,
    monthlyTrends: report.monthlyTrends,
    yearOverYear: report.yearOverYear,
    topMaintenanceVendors: report.topMaintenanceVendors,
    topMaintenanceDescriptions: report.topMaintenanceDescriptions,
    excludedTotalsSummary: {
      excludedNonOperating: report.totals.excludedNonOperating,
      topExcludedAccounts: report.topExcludedAccounts,
    },
    trueUncategorizedSummary: {
      amount: report.totals.trueUncategorized,
      topAccounts: report.topTrueUncategorizedAccounts,
    },
  };
}

function extractOutputText(result: unknown): string | null {
  if (
    typeof result === "object" &&
    result !== null &&
    "output_text" in result &&
    typeof result.output_text === "string"
  ) {
    return result.output_text;
  }

  const output = (result as { output?: Array<{ content?: Array<unknown> }> }).output;
  const textItem = output
    ?.flatMap((item) => item.content ?? [])
    .find(
      (content): content is { type: string; text: string } =>
        typeof content === "object" &&
        content !== null &&
        "type" in content &&
        content.type === "output_text" &&
        "text" in content &&
        typeof content.text === "string",
    );

  return textItem?.text ?? null;
}

function summarizeOpenAiError(errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: { message?: string };
    };
    return parsed.error?.message ?? errorText;
  } catch {
    return errorText;
  }
}
