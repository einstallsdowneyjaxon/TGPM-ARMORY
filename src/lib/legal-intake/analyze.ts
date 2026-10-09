import type { LegalAnalysisResult } from "@/lib/legal-intake/types";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "caseNumber",
    "courtName",
    "county",
    "plaintiff",
    "defendant",
    "propertyAddress",
    "intakeSummary",
    "actionCourtDates",
    "floridaResearch",
    "proposedNextSteps",
    "initialDocketEntries",
  ],
  properties: {
    title: { type: "string" },
    caseNumber: { type: "string" },
    courtName: { type: "string" },
    county: { type: "string" },
    plaintiff: { type: "string" },
    defendant: { type: "string" },
    propertyAddress: { type: "string" },
    intakeSummary: { type: "string" },
    actionCourtDates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "eventAt", "timezone"],
        properties: {
          label: { type: "string" },
          eventAt: { type: "string" },
          timezone: { type: "string" },
        },
      },
    },
    floridaResearch: { type: "string" },
    proposedNextSteps: { type: "string" },
    initialDocketEntries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["filedAt", "title", "description"],
        properties: {
          filedAt: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
};

function summarizeError(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 400);
}

function parseAnalysis(text: string): LegalAnalysisResult {
  const parsed = JSON.parse(text) as LegalAnalysisResult;
  return parsed;
}

async function runAnalysisRequest(params: {
  complaintText: string;
  supportingBlock: string;
  propertyAddressHint?: string;
  publicDocketUrl?: string;
  apiKey: string;
  model: string;
  useWebSearch: boolean;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      ...(params.useWebSearch ? { tools: [{ type: "web_search_preview" }] } : {}),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You assist a Florida property management company with operational triage when a summons or complaint arrives. " +
                (params.useWebSearch
                  ? "Use web search to find relevant Florida statutes, rules, and publicly reported case examples that match the allegations. "
                  : "Reference relevant Florida statutes and publicly known case patterns when applicable. ") +
                "Do not provide legal advice; provide practical next steps and research pointers. " +
                "Always include ISO-8601 timestamps with timezone for court dates when possible (America/New_York).",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Property address hint: ${params.propertyAddressHint || "unknown"}`,
                `Public docket URL (if any): ${params.publicDocketUrl || "none"}`,
                "",
                "PRIMARY SUMMONS/COMPLAINT TEXT:",
                params.complaintText.slice(0, 45000),
                "",
                "SUPPORTING DOCUMENTS:",
                params.supportingBlock,
                "",
                "Return JSON matching the schema. Summarize who sued whom, core claims, deadlines, and hearings.",
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "legal_intake_analysis",
          strict: true,
          schema: analysisSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI legal analysis failed (${response.status}): ${summarizeError(errText)}`,
    );
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  const text =
    payload.output_text?.trim() ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

  if (!text) {
    throw new Error("OpenAI returned an empty legal analysis response.");
  }

  return parseAnalysis(text);
}

export async function analyzeLegalIntake(params: {
  complaintText: string;
  supportingTexts: Array<{ fileName: string; text: string }>;
  propertyAddressHint?: string;
  publicDocketUrl?: string;
  apiKey: string;
  model: string;
}): Promise<LegalAnalysisResult> {
  const supportingBlock =
    params.supportingTexts.length === 0
      ? "No supporting documents uploaded."
      : params.supportingTexts
          .map(
            (doc) =>
              `--- ${doc.fileName} ---\n${doc.text.slice(0, 12000)}`,
          )
          .join("\n\n");

  try {
    return await runAnalysisRequest({
      ...params,
      supportingBlock,
      useWebSearch: true,
    });
  } catch {
    return runAnalysisRequest({
      ...params,
      supportingBlock,
      useWebSearch: false,
    });
  }
}

export async function extractDocketEntriesFromHtml(params: {
  html: string;
  matterTitle: string;
  apiKey: string;
  model: string;
}): Promise<
  Array<{ filedAt: string; title: string; description: string }>
> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["entries"],
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["filedAt", "title", "description"],
          properties: {
            filedAt: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
          },
        },
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Extract docket/filing entries from this public court docket HTML for matter "${params.matterTitle}". Return JSON only.`,
            },
            {
              type: "input_text",
              text: params.html.slice(0, 120000),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "docket_entries",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI docket parse failed (${response.status}): ${summarizeError(errText)}`,
    );
  }

  const payload = (await response.json()) as {
    output_text?: string;
  };
  const text = payload.output_text?.trim();
  if (!text) return [];

  const parsed = JSON.parse(text) as {
    entries: Array<{ filedAt: string; title: string; description: string }>;
  };
  return parsed.entries ?? [];
}
