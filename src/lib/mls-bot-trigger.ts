type MlsBotRunPayload = {
  rowNumber: number;
  taskKey: string;
  address: string;
  source: "tgpm-armory";
};

export type MlsBotTriggerResult =
  | { ok: true; status: number; response?: unknown }
  | { ok: false; warning: string; error: string; status?: number; response?: unknown };

function getMlsBotTriggerConfig() {
  return {
    runUrl: process.env.MLS_BOT_RUN_URL,
    secret: process.env.MLS_BOT_SECRET,
  };
}

export async function triggerMlsBotRun(payload: MlsBotRunPayload): Promise<MlsBotTriggerResult> {
  const { runUrl, secret } = getMlsBotTriggerConfig();

  if (!runUrl) {
    return {
      ok: false,
      warning: "Saved, but bot did not start.",
      error: "MLS_BOT_RUN_URL must be configured to trigger the MLS bot.",
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (secret) headers.Authorization = `Bearer ${secret}`;

    const response = await fetch(runUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const contentType = response.headers.get("content-type") || "";
    const responseBody = contentType.includes("application/json")
      ? await response.json().catch(() => undefined)
      : await response.text().catch(() => undefined);

    if (!response.ok) {
      return {
        ok: false,
        warning: "Saved, but bot did not start.",
        error: `MLS bot run endpoint returned HTTP ${response.status}.`,
        status: response.status,
        response: responseBody,
      };
    }

    return { ok: true, status: response.status, response: responseBody };
  } catch (error) {
    return {
      ok: false,
      warning: "Saved, but bot did not start.",
      error: error instanceof Error ? error.message : "MLS bot trigger failed.",
    };
  }
}
