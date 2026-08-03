import { createClient } from "@supabase/supabase-js";

// Using Record<string, unknown> as the Database type since we don't have
// generated types for tgpm-ip — this allows upserts without type errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createClient<AnyDatabase>> | null = null;

export function getSupabaseClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.",
    );
  }
  _client = createClient<AnyDatabase>(url, key, { auth: { persistSession: false } });
  return _client;
}
