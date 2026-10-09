import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseClient();

    const { data: matter, error: matterError } = await supabase
      .from("legal_matters")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (matterError) {
      throw new Error(matterError.message);
    }
    if (!matter) {
      return NextResponse.json({ error: "Matter not found." }, { status: 404 });
    }

    const [documents, courtDates, docketEvents, notifications] =
      await Promise.all([
        supabase
          .from("legal_documents")
          .select("*")
          .eq("matter_id", id)
          .order("uploaded_at", { ascending: true }),
        supabase
          .from("legal_court_dates")
          .select("*")
          .eq("matter_id", id)
          .order("event_at", { ascending: true }),
        supabase
          .from("legal_docket_events")
          .select("*")
          .eq("matter_id", id)
          .order("detected_at", { ascending: false }),
        supabase
          .from("legal_notification_log")
          .select("*")
          .eq("matter_id", id)
          .order("sent_at", { ascending: false })
          .limit(20),
      ]);

    return NextResponse.json({
      matter,
      documents: documents.data ?? [],
      courtDates: courtDates.data ?? [],
      docketEvents: docketEvents.data ?? [],
      notifications: notifications.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error loading legal matter.",
      },
      { status: 500 },
    );
  }
}
