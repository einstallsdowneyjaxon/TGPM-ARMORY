// ─── Job category normalization ───────────────────────────────────────────────

export function normalizeJobCategory(jobDescription: string): string {
  const jd = (jobDescription ?? "").toLowerCase();
  if (/\bturn\b|unit.turn|full.turn/.test(jd)) return "Unit Turn";
  if (/hvac|heat(ing)?|air.cond|a\/c|\bac\b|furnace|thermostat|coil|duct/.test(jd)) return "HVAC";
  if (/plumb|drain|toilet|sink|faucet|shower|tub|leak|pipe|water.heat|sewer|clog/.test(jd)) return "Plumbing";
  if (/electric|outlet|switch|breaker|light(ing)?|fixture|wiring|gfci/.test(jd)) return "Electrical";
  if (/pest|rodent|insect|bug|termite|roach|mouse|rat|wildlife|bee|wasp/.test(jd)) return "Pest Control";
  if (/applia|refriger|stove|oven|dishwash|washer|dryer|microwave|range/.test(jd)) return "Appliances";
  if (/roof|gutter|fascia|exterior|siding|window|door\b/.test(jd)) return "Exterior/Roof";
  if (/paint|drywall|floor|carpet|tile|wall|baseboard|patch/.test(jd)) return "Interior/Finishes";
  if (/landscap|lawn|mow|tree|yard|grass|bush|hedge|weed/.test(jd)) return "Landscaping";
  if (/lock|key|rekey|deadbolt|entry|access|garage.door/.test(jd)) return "Locks/Entry";
  if (/smoke|co2|carbon|detector|alarm|fire/.test(jd)) return "Safety/Detectors";
  if (/fence|gate|patio|deck|driveway|sidewalk|concrete/.test(jd)) return "Exterior/Hardscape";
  if (/clean|pressure.wash|haul|trash/.test(jd)) return "Cleaning/Haul";
  return "General Maintenance";
}

// ─── Turn/capital detection ───────────────────────────────────────────────────

const TURN_KEYWORDS = /\bturn\b|unit.turn|full.turn|make.ready|turnover/i;
const CAPITAL_THRESHOLD = 1500;
const CAPITAL_CATEGORIES = new Set(["HVAC", "Exterior/Roof", "Electrical"]);

export function classifyWorkOrder(
  jobDescription: string,
  jobCategory: string,
  billedAmount: number,
): { isTurn: boolean; isCapital: boolean } {
  const isTurn = TURN_KEYWORDS.test(jobDescription ?? "");
  const isCapital =
    !isTurn &&
    (billedAmount >= CAPITAL_THRESHOLD ||
      (CAPITAL_CATEGORIES.has(jobCategory) && billedAmount >= 800));
  return { isTurn, isCapital };
}

// ─── Tenant liability scoring ─────────────────────────────────────────────────

export type TenantLiabilityFlag = "Low" | "Watch" | "Flag";

const TENANT_KEYWORDS = [
  /clog|stopped.up|backup|backed.up/i,
  /broken.blind|broken.screen|broken.window|damaged/i,
  /lock.?out|lost.key/i,
  /dirty.filter|no.filter|replace.filter/i,
  /garbage.disposal|disposal.jam/i,
  /smoke.detect|co.detect|battery/i,
  /pet.damage|pet.odor|urine|flea/i,
  /hole.in.wall|punched|kicked/i,
];

export function scoreTenantLiability(descriptions: string[]): {
  score: number;
  flag: TenantLiabilityFlag;
  matchedKeywords: string[];
} {
  const matchedKeywords: string[] = [];
  let score = 0;

  for (const desc of descriptions) {
    for (const pattern of TENANT_KEYWORDS) {
      const match = desc.match(pattern);
      if (match) {
        const kw = match[0].toLowerCase();
        if (!matchedKeywords.includes(kw)) {
          matchedKeywords.push(kw);
          score += 15;
        }
      }
    }
  }

  const flag: TenantLiabilityFlag =
    score >= 30 ? "Flag" : score >= 15 ? "Watch" : "Low";

  return { score: Math.min(score, 100), flag, matchedKeywords };
}
