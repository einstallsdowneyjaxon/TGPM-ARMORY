import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Lightweight poll endpoint for open Maintenance Intelligence tabs.
 * Returns last AppFolio→Supabase sync stamp so the UI can refresh after hourly/daily pulls.
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("maintenance_sync_state")
      .select("last_synced_at, last_synced_count, last_sync_scope")
      .eq("id", "default")
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      lastSyncedAt: (data?.last_synced_at as string | null) ?? null,
      lastSyncedCount: data?.last_synced_count ?? 0,
      lastSyncScope: data?.last_sync_scope ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync status failed." },
      { status: 500 },
    );
  }
}
