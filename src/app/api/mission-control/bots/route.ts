import { NextResponse } from "next/server";
import {
  missionControlBots,
  type MissionControlBot,
  type MissionControlBotTelemetry,
} from "@/config/mission-control";

export const dynamic = "force-dynamic";

const BOT_FETCH_TIMEOUT_MS = 8_000;
const DOWN_ALERT_THROTTLE_MS = 15 * 60 * 1_000;
const LIVE_MISSION_CONTROL_URL =
  process.env.MISSION_CONTROL_API_URL ||
  "http://206.81.13.133:8790/api/bots";
const LIVE_MISSION_CONTROL_SECRET =
  process.env.BOT_CONTROL_SECRET ||
  process.env.MISSION_CONTROL_SECRET ||
  process.env.MLS_BOT_SECRET ||
  "";
const liveMissionControlIdMap: Record<string, string> = {
  renewal: "renewal-bot",
  "property-onboarding": "property-onboarding-bot",
  mls: "mls-bot",
};
const lastDownAlertAtByBot = new Map<string, number>();

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function fetchJson(url: string, headers?: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getLiveMissionControlTelemetry() {
  if (!LIVE_MISSION_CONTROL_SECRET) {
    return null;
  }

  const result = await fetchJson(LIVE_MISSION_CONTROL_URL, {
    Authorization: `Bearer ${LIVE_MISSION_CONTROL_SECRET}`,
  });

  if (!result.ok || !isRecord(result.body) || !Array.isArray(result.body.bots)) {
    return null;
  }

  return result.body.bots
    .filter(isRecord)
    .map((bot): MissionControlBotTelemetry | null => {
      const sourceId = typeof bot.id === "string" ? bot.id : "";
      const id = liveMissionControlIdMap[sourceId];

      if (!id) {
        return null;
      }

      const pendingCaptchaCount =
        typeof bot.pendingCaptchaCount === "number"
          ? bot.pendingCaptchaCount
          : undefined;

      return {
        id,
        name: typeof bot.name === "string" ? bot.name : id,
        status: bot.online === true ? "Online" : "Offline",
        lastRun:
          typeof bot.lastRunTime === "string"
            ? formatRunTime(bot.lastRunTime)
            : undefined,
        lastError:
          typeof bot.lastErrorMessage === "string" && bot.lastErrorMessage
            ? bot.lastErrorMessage
            : undefined,
        pendingCaptchaCount,
        pendingCaptchaStatus: getPendingCaptchaStatus(pendingCaptchaCount),
        healthCheckedAt: new Date().toISOString(),
        statusCheckedAt: new Date().toISOString(),
        alertWebhookConfigured: getAlertWebhookConfigured(),
      };
    })
    .filter((bot): bot is MissionControlBotTelemetry => Boolean(bot));
}

function formatRunTime(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
}

function getLastRunText(statusBody: unknown) {
  if (!isRecord(statusBody)) {
    return undefined;
  }

  const currentRun = statusBody.currentRun;

  if (isRecord(currentRun)) {
    const rowNumber = currentRun.rowNumber;
    return `Running${rowNumber ? ` row ${rowNumber}` : ""}`;
  }

  const lastRun = statusBody.lastRun;

  if (!isRecord(lastRun)) {
    return undefined;
  }

  const result = lastRun.ok === false ? "Failed" : "Succeeded";
  const rowNumber = lastRun.rowNumber;
  const endedAt = formatRunTime(lastRun.endedAt);
  const rowText = rowNumber ? ` row ${rowNumber}` : "";
  const timeText = endedAt ? ` at ${endedAt}` : "";

  return `${result}${rowText}${timeText}`;
}

function getLastError(statusBody: unknown) {
  if (!isRecord(statusBody)) {
    return undefined;
  }

  const lastRun = statusBody.lastRun;

  if (isRecord(lastRun) && lastRun.ok === false) {
    const error =
      lastRun.error ||
      lastRun.lastError ||
      lastRun.message ||
      statusBody.lastError;

    return typeof error === "string" ? error : "Last bot run failed.";
  }

  const lastError = statusBody.lastError;
  return typeof lastError === "string" && lastError ? lastError : undefined;
}

function getPendingCaptchaCount(statusBody: unknown) {
  if (!isRecord(statusBody)) {
    return undefined;
  }

  const pendingCaptchas = statusBody.pendingCaptchas;

  if (Array.isArray(pendingCaptchas)) {
    return pendingCaptchas.length;
  }

  if (typeof pendingCaptchas === "number") {
    return pendingCaptchas;
  }

  return undefined;
}

function getPendingCaptchaStatus(count: number | undefined) {
  if (typeof count !== "number") {
    return undefined;
  }

  return count === 0 ? "No pending CAPTCHA" : `${count} pending CAPTCHA`;
}

function getAlertWebhookConfigured() {
  return Boolean(
    process.env.MISSION_CONTROL_DOWN_ALERT_WEBHOOK_URL ||
      process.env.MISSION_CONTROL_ALERT_WEBHOOK_URL,
  );
}

function getAlertWebhookUrl() {
  return (
    process.env.MISSION_CONTROL_DOWN_ALERT_WEBHOOK_URL ||
    process.env.MISSION_CONTROL_ALERT_WEBHOOK_URL ||
    ""
  );
}

async function sendDownAlertIfNeeded(
  bot: MissionControlBot,
  telemetry: MissionControlBotTelemetry,
) {
  const webhookUrl = getAlertWebhookUrl();

  if (!webhookUrl || telemetry.status !== "Offline") {
    return;
  }

  const now = Date.now();
  const lastSentAt = lastDownAlertAtByBot.get(bot.id) || 0;

  if (now - lastSentAt < DOWN_ALERT_THROTTLE_MS) {
    telemetry.alertLastSentAt = new Date(lastSentAt).toISOString();
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "tgpm-armory",
        event: "mission-control-bot-down",
        botId: bot.id,
        botName: bot.name,
        status: telemetry.status,
        healthUrl: bot.healthUrl,
        statusUrl: bot.statusUrl,
        lastRun: telemetry.lastRun,
        lastError: telemetry.lastError,
        checkedAt: new Date().toISOString(),
      }),
    });

    lastDownAlertAtByBot.set(bot.id, now);
    telemetry.alertLastSentAt = new Date(now).toISOString();
  } catch {
    // Alert delivery must not break Mission Control dashboard status.
  }
}

async function getBotTelemetry(
  bot: MissionControlBot,
): Promise<MissionControlBotTelemetry> {
  const telemetry: MissionControlBotTelemetry = {
    id: bot.id,
    name: bot.name,
    status: bot.status,
    alertWebhookConfigured: getAlertWebhookConfigured(),
  };

  if (!bot.healthUrl && !bot.statusUrl) {
    return telemetry;
  }

  let healthOk = false;

  if (bot.healthUrl) {
    try {
      const health = await fetchJson(bot.healthUrl);
      const healthBody = health.body;

      healthOk =
        health.ok &&
        (!isRecord(healthBody) || healthBody.ok === true || healthBody.ok === undefined);

      telemetry.status = healthOk ? "Online" : "Offline";
      telemetry.healthCheckedAt = new Date().toISOString();
    } catch (error) {
      telemetry.status = "Offline";
      telemetry.lastError =
        error instanceof Error ? error.message : "Health check failed.";
      telemetry.healthCheckedAt = new Date().toISOString();
    }
  }

  if (bot.statusUrl) {
    try {
      const status = await fetchJson(bot.statusUrl);
      const statusBody = status.body;
      const pendingCaptchaCount = getPendingCaptchaCount(statusBody);

      telemetry.lastRun = getLastRunText(statusBody);
      telemetry.lastError = getLastError(statusBody) || telemetry.lastError;
      telemetry.pendingCaptchaCount = pendingCaptchaCount;
      telemetry.pendingCaptchaStatus = getPendingCaptchaStatus(pendingCaptchaCount);
      telemetry.statusCheckedAt = new Date().toISOString();

      if (!status.ok && telemetry.status === "Online") {
        telemetry.status = "Warning";
        telemetry.lastError = `Status endpoint returned HTTP ${status.status}.`;
      } else if (healthOk && telemetry.status !== "Offline") {
        telemetry.status = "Online";
      }
    } catch (error) {
      if (telemetry.status === "Online") {
        telemetry.status = "Warning";
      }

      telemetry.lastError =
        error instanceof Error ? error.message : "Status check failed.";
      telemetry.statusCheckedAt = new Date().toISOString();
    }
  }

  await sendDownAlertIfNeeded(bot, telemetry);

  return telemetry;
}

export async function GET() {
  try {
    const liveBots = await getLiveMissionControlTelemetry();

    if (liveBots?.length) {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        bots: liveBots,
        source: "coco-xr-mission-control",
      });
    }
  } catch {
    // Fall back to local/default bot telemetry if the live dashboard API is unavailable.
  }

  const bots = await Promise.all(missionControlBots.map(getBotTelemetry));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    bots,
    source: "tgpm-armory",
  });
}
