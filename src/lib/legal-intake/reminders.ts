import { sendCourtReminderEmail } from "@/lib/legal-intake/email";
import { getSupabaseClient } from "@/lib/supabase";

function daysUntil(eventAt: string, now = new Date()) {
  const event = new Date(eventAt);
  const diffMs = event.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function shouldSendReminder(params: {
  daysUntil: number;
  lastReminderSentAt: string | null;
  now: Date;
}) {
  if (params.daysUntil < 0) return false;
  if (params.daysUntil > 30) return false;

  const last = params.lastReminderSentAt
    ? new Date(params.lastReminderSentAt)
    : null;

  if (params.daysUntil <= 7) {
    if (!last) return true;
    const hoursSince = (params.now.getTime() - last.getTime()) / (1000 * 60 * 60);
    return hoursSince >= 48;
  }

  if (!last) return true;
  const daysSince =
    (params.now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= 7;
}

export async function runCourtDateReminders() {
  const supabase = getSupabaseClient();
  const now = new Date();

  const { data: rows, error } = await supabase
    .from("legal_court_dates")
    .select(
      "id, matter_id, label, event_at, last_reminder_sent_at, legal_matters ( id, title, status )",
    )
    .gte("event_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    throw new Error(`Failed to load court dates: ${error.message}`);
  }

  const grouped = new Map<
    string,
    {
      title: string;
      reminders: Array<{
        id: string;
        label: string;
        eventAt: string;
        daysUntil: number;
        urgent: boolean;
      }>;
    }
  >();

  for (const row of rows ?? []) {
    const matterRaw = row.legal_matters as
      | { id: string; title: string; status: string }
      | Array<{ id: string; title: string; status: string }>;
    const matter = Array.isArray(matterRaw) ? matterRaw[0] : matterRaw;
    if (!matter) continue;
    if (matter.status !== "active") continue;

    const until = daysUntil(row.event_at, now);
    if (
      !shouldSendReminder({
        daysUntil: until,
        lastReminderSentAt: row.last_reminder_sent_at,
        now,
      })
    ) {
      continue;
    }

    const bucket = grouped.get(matter.id) ?? {
      title: matter.title,
      reminders: [],
    };
    bucket.reminders.push({
      id: row.id,
      label: row.label,
      eventAt: row.event_at,
      daysUntil: until,
      urgent: until <= 7,
    });
    grouped.set(matter.id, bucket);
  }

  let sent = 0;
  for (const [matterId, payload] of grouped.entries()) {
    const urgent = payload.reminders.some((item) => item.urgent);
    await sendCourtReminderEmail({
      matterId,
      title: payload.title,
      reminders: payload.reminders.map((item) => ({
        label: item.label,
        eventAt: item.eventAt,
        daysUntil: item.daysUntil,
      })),
      urgent,
    });

    const ids = payload.reminders.map((item) => item.id);
    await supabase
      .from("legal_court_dates")
      .update({ last_reminder_sent_at: now.toISOString() })
      .in("id", ids);

    sent += 1;
  }

  return { mattersNotified: sent, courtDatesConsidered: rows?.length ?? 0 };
}
