import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Occupancy work-order history for Today's WO expandable cards.
 * Prefer occupancy_id; fall back to requesting_resident + unit_address.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const occupancyId = url.searchParams.get("occupancy_id")?.trim() || "";
    const resident = url.searchParams.get("requesting_resident")?.trim() || "";
    const unitAddress = url.searchParams.get("unit_address")?.trim() || "";
    const exclude = url.searchParams.get("exclude")?.trim() || "";

    if (!occupancyId && !(resident && unitAddress)) {
      return NextResponse.json(
        { error: "Provide occupancy_id, or requesting_resident + unit_address." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseClient();
    let query = supabase
      .from("work_orders")
      .select(
        "work_order_number, unit_address, job_description, service_request_description, job_category, billed_amount, status, created_at_af, requesting_resident, occupancy_id, is_turn, is_capital",
      )
      .order("created_at_af", { ascending: false })
      .limit(100);

    if (occupancyId) {
      query = query.eq("occupancy_id", occupancyId);
    } else {
      query = query.eq("requesting_resident", resident).eq("unit_address", unitAddress);
    }

    if (exclude) {
      query = query.neq("work_order_number", exclude);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      history: data ?? [],
      count: data?.length ?? 0,
      occupancy_id: occupancyId || null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "History query failed." },
      { status: 500 },
    );
  }
}
