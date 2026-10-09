import { createHash } from "node:crypto";
import { extractDocketEntriesFromHtml } from "@/lib/legal-intake/analyze";
import { sendDocketChangeEmail } from "@/lib/legal-intake/email";
import { getSupabaseClient } from "@/lib/supabase";

function normalizeDocketHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runPublicDocketWatch() {
  const supabase = getSupabaseClient();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const { data: matters, error } = await supabase
    .from("legal_matters")
    .select("id, title, public_docket_url, docket_page_hash")
    .eq("status", "active")
    .not("public_docket_url", "is", null);

  if (error) {
    throw new Error(`Failed to load matters for docket watch: ${error.message}`);
  }

  let checked = 0;
  let changed = 0;

  for (const matter of matters ?? []) {
    const url = matter.public_docket_url?.trim();
    if (!url) continue;

    checked += 1;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "TGPM-Legal-Intake-Docket-Watch/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      continue;
    }

    const html = normalizeDocketHtml(await response.text());
    const hash = createHash("sha256").update(html).digest("hex");

    await supabase
      .from("legal_matters")
      .update({
        docket_last_checked_at: new Date().toISOString(),
        docket_page_hash: hash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matter.id);

    if (matter.docket_page_hash && matter.docket_page_hash === hash) {
      continue;
    }

    if (!matter.docket_page_hash) {
      continue;
    }

    const entries = await extractDocketEntriesFromHtml({
      html,
      matterTitle: matter.title,
      apiKey,
      model,
    });

    if (entries.length === 0) {
      continue;
    }

    const { data: existing } = await supabase
      .from("legal_docket_events")
      .select("title, description, filed_at")
      .eq("matter_id", matter.id);

    const existingKeys = new Set(
      (existing ?? []).map(
        (row) =>
          `${row.title}|${row.description ?? ""}|${row.filed_at ?? ""}`,
      ),
    );

    const fresh = entries.filter(
      (entry) =>
        !existingKeys.has(
          `${entry.title}|${entry.description}|${entry.filedAt ?? ""}`,
        ),
    );

    if (fresh.length === 0) {
      continue;
    }

    await supabase.from("legal_docket_events").insert(
      fresh.map((entry) => ({
        matter_id: matter.id,
        filed_at: entry.filedAt || null,
        title: entry.title,
        description: entry.description,
        source: "auto_check",
      })),
    );

    await sendDocketChangeEmail({
      matterId: matter.id,
      title: matter.title,
      newEntries: fresh,
    });

    changed += 1;
  }

  return { checked, changed };
}
