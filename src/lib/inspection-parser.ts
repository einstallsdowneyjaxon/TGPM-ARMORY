export type InspectionItem = {
  area: string;
  detail: string;
  condition: "S" | "F" | "D";
  comment: string;
};

export type MatchedItem = {
  area: string;
  detail: string;
  moveIn: { condition: string; comment: string } | null;
  moveOut: { condition: string; comment: string } | null;
};

export type InspectionComparison = {
  property: string;
  tenantName: string;
  moveInDate: string;
  moveOutDate: string;
  newDamage: MatchedItem[];
  preExisting: MatchedItem[];
  resolved: MatchedItem[];
  itemCount: { moveIn: number; moveOut: number };
};

// ─── Extraction ───────────────────────────────────────────────────────────────

type ExtractionResult = {
  property: string;
  tenantName: string;
  date: string;
  items: InspectionItem[];
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["property", "tenantName", "date", "items"],
  properties: {
    property: { type: "string" },
    tenantName: { type: "string" },
    date: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "detail", "condition", "comment"],
        properties: {
          area: { type: "string" },
          detail: { type: "string" },
          condition: { type: "string", enum: ["S", "F", "D"] },
          comment: { type: "string" },
        },
      },
    },
  },
};

async function extractInspectionItems(
  rawText: string,
  apiKey: string,
  model: string,
): Promise<ExtractionResult> {
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
            "You are a property inspection data extractor. Extract ALL inspection items from this zInspector report text. Each item has an area (room/zone such as 'Kitchen' or 'Bedroom: Primary'), a detail (specific component such as 'Refrigerator' or 'Other'), a condition (S=Satisfactory, F=Fair, D=Damaged), and a comment (include even if condition is S — sometimes items are marked Satisfactory but still have a damage comment). Include every item you find. Also extract the property address, tenant name (leave blank if not listed), and inspection date (YYYY-MM-DD). De-duplicate items that appear in both the summary table and the per-area sections — keep only one entry per unique area+detail combination.",
        },
        { role: "user", content: rawText },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "inspection_extraction",
          strict: true,
          schema: extractionSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI extraction failed (${response.status}): ${summarizeError(errText)}`,
    );
  }

  const result = await response.json();
  const text = extractOutputText(result);
  if (!text) throw new Error("OpenAI returned an empty extraction response.");
  return JSON.parse(text) as ExtractionResult;
}

// ─── Semantic comparison ──────────────────────────────────────────────────────

type ComparedItemRaw = {
  room: string;
  issue: string;
  moveInComment: string;
  moveOutComment: string;
  moveInCondition: string;
  moveOutCondition: string;
};

type ComparisonRaw = {
  newDamage: ComparedItemRaw[];
  preExisting: ComparedItemRaw[];
  resolved: ComparedItemRaw[];
};

const comparedItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "room",
    "issue",
    "moveInComment",
    "moveOutComment",
    "moveInCondition",
    "moveOutCondition",
  ],
  properties: {
    room: { type: "string" },
    issue: { type: "string" },
    moveInComment: { type: "string" },
    moveOutComment: { type: "string" },
    moveInCondition: { type: "string" },
    moveOutCondition: { type: "string" },
  },
};

const comparisonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["newDamage", "preExisting", "resolved"],
  properties: {
    newDamage: { type: "array", items: comparedItemSchema },
    preExisting: { type: "array", items: comparedItemSchema },
    resolved: { type: "array", items: comparedItemSchema },
  },
};

async function semanticallyCompareItems(
  moveInItems: InspectionItem[],
  moveOutItems: InspectionItem[],
  apiKey: string,
  model: string,
): Promise<ComparisonRaw> {
  const payload = {
    moveIn: moveInItems.map((i) => ({
      room: i.area,
      detail: i.detail,
      condition: i.condition,
      comment: i.comment,
    })),
    moveOut: moveOutItems.map((i) => ({
      room: i.area,
      detail: i.detail,
      condition: i.condition,
      comment: i.comment,
    })),
  };

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
          content: `You are a property inspection analyst comparing move-in and move-out reports for a property manager.

Each item has a room, a detail label (almost always "Other" — ignore it), a condition tag (S/F/D — unreliable, ignore it), and a comment. The comment is the only reliable data.

EXCLUDE before classifying: Any item whose comment is blank or is clearly a routine sign-off with no damage described (e.g. "Keys returned", "Working", "OK", a component name with no issue stated). Do not put these in any bucket.

CLASSIFY the remaining items:

preExisting — The same specific damage issue appears in both move-in and move-out for the same room. The comments must refer to the same thing (e.g. "Touch up paint" and "Paint touch up, carpet stains" in the same room = same issue). Tenant is NOT responsible.

newDamage — Damage in move-out with no matching issue in move-in for that room. Tenant MAY be responsible.

resolved — Noted at move-in but not in move-out.

NON-NEGOTIABLE RULES:
- Every move-out item with a real damage comment must appear in either newDamage or preExisting. Do not drop any.
- When unsure whether a move-out item matches a move-in item, classify it as newDamage.
- Same room is NOT enough for a match. The comments must describe the same specific damage. "No lights" and "Keys/Remotes/Devices" in the same room are two completely different things — never match them.
- Use exact original comment text. Do not combine or invent items.

For each item: room = room name, issue = brief label for the specific damage, moveInComment/moveOutComment = exact original comment ("" if not present in that report), moveInCondition/moveOutCondition = the condition tag ("" if not present).`,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "inspection_comparison",
          strict: true,
          schema: comparisonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `OpenAI comparison failed (${response.status}): ${summarizeError(errText)}`,
    );
  }

  const result = await response.json();
  const text = extractOutputText(result);
  if (!text) throw new Error("OpenAI returned an empty comparison response.");
  return JSON.parse(text) as ComparisonRaw;
}

function toMatchedItem(item: ComparedItemRaw): MatchedItem {
  return {
    area: item.room,
    detail: item.issue,
    moveIn:
      item.moveInComment
        ? { condition: item.moveInCondition, comment: item.moveInComment }
        : null,
    moveOut:
      item.moveOutComment
        ? { condition: item.moveOutCondition, comment: item.moveOutComment }
        : null,
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function compareInspections(
  moveInText: string,
  moveOutText: string,
  apiKey: string,
  model = "gpt-4.1-mini",
): Promise<InspectionComparison> {
  // Step 1: extract items from both PDFs in parallel
  const [moveIn, moveOut] = await Promise.all([
    extractInspectionItems(moveInText, apiKey, model),
    extractInspectionItems(moveOutText, apiKey, model),
  ]);

  // Step 2: semantic comparison — AI matches by room + comment, ignores condition tags
  const comparison = await semanticallyCompareItems(
    moveIn.items,
    moveOut.items,
    apiKey,
    model,
  );

  return {
    property: moveIn.property || moveOut.property,
    tenantName: moveIn.tenantName || moveOut.tenantName,
    moveInDate: moveIn.date,
    moveOutDate: moveOut.date,
    newDamage: comparison.newDamage.map(toMatchedItem),
    preExisting: comparison.preExisting.map(toMatchedItem),
    resolved: comparison.resolved.map(toMatchedItem),
    itemCount: { moveIn: moveIn.items.length, moveOut: moveOut.items.length },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractOutputText(result: unknown): string | null {
  if (
    typeof result === "object" &&
    result !== null &&
    "output_text" in result &&
    typeof result.output_text === "string"
  ) {
    return result.output_text;
  }

  const output = (result as { output?: Array<{ content?: Array<unknown> }> })
    .output;
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

function summarizeError(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
}
