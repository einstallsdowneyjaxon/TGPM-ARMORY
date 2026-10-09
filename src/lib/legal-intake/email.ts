import {
  getArmoryBaseUrl,
  getLegalAlertRecipients,
  getLegalEmailFrom,
  LEGAL_DISCLAIMER,
} from "@/lib/legal-intake/config";
import { getSupabaseClient } from "@/lib/supabase";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendLegalEmail(params: {
  matterId?: string;
  kind: string;
  subject: string;
  html: string;
  recipients?: string[];
}) {
  const recipients = params.recipients ?? getLegalAlertRecipients();
  if (recipients.length === 0) {
    throw new Error(
      "No LEGAL_ALERT_EMAILS configured. Set LEGAL_ALERT_EMAILS or LEGAL_ALERT_EMAIL_1..3.",
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY for legal intake email delivery.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getLegalEmailFrom(),
      to: recipients,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${errText.slice(0, 300)}`);
  }

  const supabase = getSupabaseClient();
  await supabase.from("legal_notification_log").insert({
    matter_id: params.matterId ?? null,
    kind: params.kind,
    recipients,
    subject: params.subject,
    meta: { provider: "resend" },
  });
}

export async function sendIntakeAlertEmail(params: {
  matterId: string;
  title: string;
  summary: string;
  courtDates: Array<{ label: string; eventAt: string }>;
  nextSteps: string;
}) {
  const baseUrl = getArmoryBaseUrl();
  const matterUrl = `${baseUrl}/legal-intake/${params.matterId}`;
  const datesHtml =
    params.courtDates.length === 0
      ? "<p>No court dates detected yet.</p>"
      : `<ul>${params.courtDates
          .map(
            (date) =>
              `<li><strong>${escapeHtml(date.label)}</strong>: ${escapeHtml(date.eventAt)}</li>`,
          )
          .join("")}</ul>`;

  const html = `
    <h2>New legal intake: ${escapeHtml(params.title)}</h2>
    <p><strong>Summary</strong></p>
    <p>${escapeHtml(params.summary)}</p>
    <p><strong>Action court dates</strong></p>
    ${datesHtml}
    <p><strong>Proposed next steps (AI, not legal advice)</strong></p>
    <p>${escapeHtml(params.nextSteps)}</p>
    <p><a href="${matterUrl}">Open mini docket in TGPM Armory</a></p>
    <hr />
    <p><em>${escapeHtml(LEGAL_DISCLAIMER)}</em></p>
  `;

  await sendLegalEmail({
    matterId: params.matterId,
    kind: "intake_alert",
    subject: `[Legal Intake] ${params.title}`,
    html,
  });
}

export async function sendCourtReminderEmail(params: {
  matterId: string;
  title: string;
  reminders: Array<{ label: string; eventAt: string; daysUntil: number }>;
  urgent: boolean;
}) {
  const baseUrl = getArmoryBaseUrl();
  const matterUrl = `${baseUrl}/legal-intake/${params.matterId}`;
  const list = params.reminders
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.label)}</strong> — ${escapeHtml(item.eventAt)} (${item.daysUntil} day(s) away)</li>`,
    )
    .join("");

  const html = `
    <h2>${params.urgent ? "Urgent" : "Upcoming"} court date reminder</h2>
    <p>Matter: <strong>${escapeHtml(params.title)}</strong></p>
    <ul>${list}</ul>
    <p><a href="${matterUrl}">View docket</a></p>
    <hr />
    <p><em>${escapeHtml(LEGAL_DISCLAIMER)}</em></p>
  `;

  await sendLegalEmail({
    matterId: params.matterId,
    kind: params.urgent ? "court_reminder_urgent" : "court_reminder",
    subject: `[Legal Reminder${params.urgent ? " — within 7 days" : ""}] ${params.title}`,
    html,
  });
}

export async function sendDocketChangeEmail(params: {
  matterId: string;
  title: string;
  newEntries: Array<{ title: string; description: string; filedAt: string }>;
}) {
  const baseUrl = getArmoryBaseUrl();
  const matterUrl = `${baseUrl}/legal-intake/${params.matterId}`;
  const list = params.newEntries
    .map(
      (entry) =>
        `<li><strong>${escapeHtml(entry.title)}</strong> (${escapeHtml(entry.filedAt)}): ${escapeHtml(entry.description)}</li>`,
    )
    .join("");

  const html = `
    <h2>Public docket update detected</h2>
    <p>Matter: <strong>${escapeHtml(params.title)}</strong></p>
    <ul>${list}</ul>
    <p><a href="${matterUrl}">Review mini docket</a></p>
    <hr />
    <p><em>${escapeHtml(LEGAL_DISCLAIMER)}</em></p>
  `;

  await sendLegalEmail({
    matterId: params.matterId,
    kind: "docket_change",
    subject: `[Docket Update] ${params.title}`,
    html,
  });
}
