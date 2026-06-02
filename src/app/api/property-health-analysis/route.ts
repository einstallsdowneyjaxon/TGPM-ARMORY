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
    "financialHealthScore",
    "maintenanceHealthScore",
    "reserveHealthScore",
    "riskScore",
    "topRedFlags",
    "risingMaintenanceAlerts",
    "recurringIssueDetection",
    "ownerFacingSummary",
    "internalTgpmActionPlan",
  ],
  properties: {
    overallHealthScore: { type: "number", minimum: 0, maximum: 100 },
    financialHealthScore: { type: "number", minimum: 0, maximum: 100 },
    maintenanceHealthScore: { type: "number", minimum: 0, maximum: 100 },
    reserveHealthScore: { type: "number", minimum: 0, maximum: 100 },
    riskScore: { type: "number", minimum: 0, maximum: 100 },
    topRedFlags: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    risingMaintenanceAlerts: {
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
              "You are an expert property management financial and maintenance analyst for TG Property Management. Analyze only the clean calculated summaries supplied by the app. Never invent totals, rows, vendors, dates, units, or transactions. Excluded non-operating activity and true uncategorized summaries are data-quality context only and must not be treated as operating performance. Keep owner-facing language polished, clear, and non-alarming.",
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
      "Return structured JSON. Use only the calculated summaries below. Do not infer or invent totals. Scores should evaluate operating performance, maintenance trajectory, reserves/owner-funding posture, and risk. Excluded non-operating and true uncategorized data should only inform data-quality caveats.",
    propertyAddress: report.propertyName,
    dateRange: report.dateRange,
    operatingIncome: report.totals.operatingIncome,
    operatingExpenses: report.totals.operatingExpenses,
    estimatedNoiCashFlow: report.totals.estimatedNoiCashFlow,
    maintenanceTotals: {
      total: report.totals.maintenanceTotal,
      subcategories: report.maintenanceSubcategories,
    },
    maintenanceWatchlist: report.maintenanceWatchlist.map((item) => ({
      category: item.label,
      amount: item.amount,
      transactionCount: item.transactionCount,
      averageTransactionAmount: item.averageTransactionAmount,
      latestTransactionDate: item.latestTransactionDate,
      trendDirection: item.trendDirection,
      trendBasis: item.trendBasis,
      riskLevel: item.riskLevel,
    })),
    monthlyTrends: report.monthlyTrends,
    yearOverYear: report.yearOverYear,
    excludedNonOperatingSummary: {
      amount: report.totals.excludedNonOperating,
      rowCount: report.excludedRowCount,
      topAccounts: report.topExcludedAccounts,
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
