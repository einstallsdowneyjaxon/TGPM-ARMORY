import { NextResponse } from "next/server";
import { runPublicDocketWatch } from "@/lib/legal-intake/docket-watch";
import { runCourtDateReminders } from "@/lib/legal-intake/reminders";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const scope = new URL(request.url).searchParams.get("scope");
    if (scope === "reminders") {
      const reminders = await runCourtDateReminders();
      return NextResponse.json({ ok: true, reminders });
    }
    if (scope === "docket") {
      const docket = await runPublicDocketWatch();
      return NextResponse.json({ ok: true, docket });
    }

    const [reminders, docket] = await Promise.all([
      runCourtDateReminders(),
      runPublicDocketWatch(),
    ]);

    return NextResponse.json({ ok: true, reminders, docket });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error running legal intake cron.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
