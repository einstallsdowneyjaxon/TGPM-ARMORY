// ─── Public types ─────────────────────────────────────────────────────────────

export type IssueCard = {
  room: string;
  issue: string;
  moveInComment: string;   // empty string means "not noted at move-in"
  moveOutComment: string;
};

export type ListItem = {
  room: string;
  comment: string;
  charge: string;          // empty string means no auto-charge
};

export type InspectionResult = {
  property: string;
  tenantName: string;
  moveInDate: string;
  moveOutDate: string;
  cards: IssueCard[];
  newDamageList: ListItem[];
  itemCount: { moveIn: number; moveOut: number };
};

// ─── Extraction ───────────────────────────────────────────────────────────────

export type InspectionItem = {
  area: string;
  detail: string;
  condition: "S" | "F" | "D";
  comment: string;
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
            "You are a property inspection data extractor. Extract ALL inspection items from this zInspector report text. Each item has an area (room/zone), a detail (component, usually 'Other'), a condition (S/F/D), and a comment. Include every item found, including Satisfactory ones — some Satisfactory items still have real damage comments. Also extract property address, tenant name (blank if not listed), and inspection date (YYYY-MM-DD). De-duplicate items that appear in both the summary and per-area sections.",
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
    throw new Error(`OpenAI extraction failed (${response.status}): ${summarizeError(errText)}`);
  }

  const result = await response.json();
  const text = extractOutputText(result);
  if (!text) throw new Error("OpenAI returned an empty extraction response.");
  return JSON.parse(text) as ExtractionResult;
}

// ─── Comparison ───────────────────────────────────────────────────────────────

type CardRaw = {
  room: string;
  issue: string;
  moveInComment: string;
  moveOutComment: string;
};

type ComparisonRaw = {
  cards: CardRaw[];
};

const cardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["room", "issue", "moveInComment", "moveOutComment"],
  properties: {
    room: { type: "string" },
    issue: { type: "string" },
    moveInComment: { type: "string" },
    moveOutComment: { type: "string" },
  },
};

const comparisonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: { type: "array", items: cardSchema },
  },
};

async function buildCards(
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

Your job: For every damage or issue noted in the MOVE-OUT report, produce one card. Each card shows what was noted at move-out AND whether the same specific issue was also noted at move-in.

INPUT: Two JSON arrays of inspection items. Each item has: room, detail, condition, comment.

OUTPUT: An array of cards, one per move-out issue.

RULES:

1. The comment is the only reliable data. Ignore condition tags (S/F/D) — they are unreliable. Ignore the detail field (it is almost always "Other").

2. EXCLUDE move-out items with blank comments or routine sign-offs that describe no damage (e.g. "OK", "Working", "Keys returned", a component name with no actual issue stated). Do not create cards for these.

3. For each qualifying move-out item, check if the SAME specific damage exists in the move-in report for the same room:
   - If yes: set moveInComment to the exact move-in comment text.
   - If no: set moveInComment to "" (empty string).
   - Match only when the comments describe the same specific thing. Being in the same room is not enough — "No lights" and "Keys/Remotes/Devices" in the same room are completely different issues.

4. Room name normalization: treat these as the same room (use the MOVE-OUT room name on every card):
   - "Master Bedroom" = "Primary Bedroom" = "Bedroom: Primary"
   - "Master Bath" = "Master Bathroom" = "Primary Bathroom" = "Bathroom: Primary"
   - Any other obvious alternate names for the same room

5. Every qualifying move-out comment gets its own card. Do not combine multiple distinct issues into one card.

6. Use exact original comment text. Do not rewrite, shorten, or combine comments.

7. issue = a short label for the damage (e.g. "Slow drain", "Paint touch up", "Replace carpet").`,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "inspection_cards",
          strict: true,
          schema: comparisonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI comparison failed (${response.status}): ${summarizeError(errText)}`);
  }

  const result = await response.json();
  const text = extractOutputText(result);
  if (!text) throw new Error("OpenAI returned an empty comparison response.");
  return JSON.parse(text) as ComparisonRaw;
}

// ─── Auto-charge detection ────────────────────────────────────────────────────

function detectCharge(room: string, issue: string, comment: string): string {
  const text = `${room} ${issue} ${comment}`.toLowerCase();

  if (/filter/.test(text)) {
    return "Add HVAC Service/Coil Clean charge";
  }
  if (/slow.?drain/.test(text)) {
    return "Add Sink snake out charge";
  }
  if (/\bmow\b|long grass|overgrown|\bweed|trim limb|trim tree|raise canopy/.test(text)) {
    return "Add Landscaping charge";
  }
  return "";
}

// ─── Itemized list builder ─────────────────────────────────────────────────────

function buildNewDamageList(cards: IssueCard[]): ListItem[] {
  const list: ListItem[] = [];

  for (const card of cards) {
    const isNew = card.moveInComment === "";
    const charge = detectCharge(card.room, card.issue, card.moveOutComment);

    if (isNew) {
      // New damage — always appears in the list, with charge if applicable
      list.push({ room: card.room, comment: card.moveOutComment, charge });
    } else if (charge) {
      // Pre-existing but triggers an auto-charge — add the charge line
      list.push({ room: card.room, comment: card.moveOutComment, charge });
    }
    // Pre-existing with no charge — skip; PM sees it on the card
  }

  return list;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function compareInspections(
  moveInText: string,
  moveOutText: string,
  apiKey: string,
  model = "gpt-4.1-mini",
): Promise<InspectionResult> {
  // Step 1: extract items from both PDFs in parallel
  const [moveIn, moveOut] = await Promise.all([
    extractInspectionItems(moveInText, apiKey, model),
    extractInspectionItems(moveOutText, apiKey, model),
  ]);

  // Step 2: build one card per move-out issue with move-in context
  const comparison = await buildCards(moveIn.items, moveOut.items, apiKey, model);

  const cards: IssueCard[] = comparison.cards.map((c) => ({
    room: c.room,
    issue: c.issue,
    moveInComment: c.moveInComment,
    moveOutComment: c.moveOutComment,
  }));

  // Step 3: build itemized list in TypeScript (new items + auto-charges)
  const newDamageList = buildNewDamageList(cards);

  return {
    property: moveIn.property || moveOut.property,
    tenantName: moveIn.tenantName || moveOut.tenantName,
    moveInDate: moveIn.date,
    moveOutDate: moveOut.date,
    cards,
    newDamageList,
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

function summarizeError(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
}
