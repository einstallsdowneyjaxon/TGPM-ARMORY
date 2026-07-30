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
            "You are a property inspection data extractor. Extract ALL inspection items from this zInspector report text. Each item has an area (room/zone such as 'Kitchen' or 'Bedroom: Primary'), a detail (specific component such as 'Refrigerator' or 'Other'), a condition (S=Satisfactory, F=Fair, D=Damaged), and an optional comment. Include every item you find, including Satisfactory ones. Also extract the property address, tenant name (leave blank if not listed), and inspection date (YYYY-MM-DD format). De-duplicate items that appear in both the summary table at the top and the per-area sections — keep only one entry per unique area+detail combination.",
        },
        {
          role: "user",
          content: rawText,
        },
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
    throw new Error(`OpenAI extraction failed (${response.status}): ${summarizeError(errText)}`);
  }

  const result = await response.json();
  const text = extractOutputText(result);
  if (!text) throw new Error("OpenAI returned an empty extraction response.");
  return JSON.parse(text) as ExtractionResult;
}

function normalizeKey(area: string, detail: string) {
  return `${area.trim().toLowerCase()}||${detail.trim().toLowerCase()}`;
}

function isBad(condition: string) {
  return condition === "D" || condition === "F";
}

export async function compareInspections(
  moveInText: string,
  moveOutText: string,
  apiKey: string,
  model = "gpt-4.1-mini",
): Promise<InspectionComparison> {
  const [moveIn, moveOut] = await Promise.all([
    extractInspectionItems(moveInText, apiKey, model),
    extractInspectionItems(moveOutText, apiKey, model),
  ]);

  const moveInMap = new Map<string, InspectionItem>();
  for (const item of moveIn.items) {
    moveInMap.set(normalizeKey(item.area, item.detail), item);
  }

  const moveOutMap = new Map<string, InspectionItem>();
  for (const item of moveOut.items) {
    moveOutMap.set(normalizeKey(item.area, item.detail), item);
  }

  const newDamage: MatchedItem[] = [];
  const preExisting: MatchedItem[] = [];
  const seenKeys = new Set<string>();

  for (const outItem of moveOut.items) {
    if (!isBad(outItem.condition)) continue;
    const key = normalizeKey(outItem.area, outItem.detail);
    seenKeys.add(key);
    const inItem = moveInMap.get(key);

    if (!inItem || !isBad(inItem.condition)) {
      newDamage.push({
        area: outItem.area,
        detail: outItem.detail,
        moveIn: inItem
          ? { condition: inItem.condition, comment: inItem.comment }
          : null,
        moveOut: { condition: outItem.condition, comment: outItem.comment },
      });
    } else {
      preExisting.push({
        area: outItem.area,
        detail: outItem.detail,
        moveIn: { condition: inItem.condition, comment: inItem.comment },
        moveOut: { condition: outItem.condition, comment: outItem.comment },
      });
    }
  }

  // Resolved: bad at move-in, not flagged bad at move-out
  const resolved: MatchedItem[] = [];
  for (const inItem of moveIn.items) {
    if (!isBad(inItem.condition)) continue;
    const key = normalizeKey(inItem.area, inItem.detail);
    if (seenKeys.has(key)) continue;
    const outItem = moveOutMap.get(key);
    resolved.push({
      area: inItem.area,
      detail: inItem.detail,
      moveIn: { condition: inItem.condition, comment: inItem.comment },
      moveOut: outItem
        ? { condition: outItem.condition, comment: outItem.comment }
        : null,
    });
  }

  return {
    property: moveIn.property || moveOut.property,
    tenantName: moveIn.tenantName || moveOut.tenantName,
    moveInDate: moveIn.date,
    moveOutDate: moveOut.date,
    newDamage,
    preExisting,
    resolved,
    itemCount: { moveIn: moveIn.items.length, moveOut: moveOut.items.length },
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
