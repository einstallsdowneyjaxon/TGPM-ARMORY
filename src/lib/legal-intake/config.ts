export const LEGAL_DISCLAIMER =
  "This is AI-generated operational guidance, not legal advice. Consult licensed Florida counsel before taking action.";

export function getLegalAlertRecipients(): string[] {
  const combined = process.env.LEGAL_ALERT_EMAILS?.trim();
  if (combined) {
    return combined
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
  }

  return [
    process.env.LEGAL_ALERT_EMAIL_1,
    process.env.LEGAL_ALERT_EMAIL_2,
    process.env.LEGAL_ALERT_EMAIL_3,
  ].filter((email): email is string => Boolean(email?.trim()));
}

export function getLegalEmailFrom(): string {
  return (
    process.env.LEGAL_EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "TGPM Legal Intake <legal-intake@thetgpm.com>"
  );
}

export function getArmoryBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
