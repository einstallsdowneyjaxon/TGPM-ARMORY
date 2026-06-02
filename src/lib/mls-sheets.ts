import { google, sheets_v4 } from "googleapis";
import {
  MLS_READY_SHEET,
  MLS_SPREADSHEET_ID,
  MLS_TODO_SHEET,
  mlsPmFields,
  mlsReadyHeaders,
  rentCastFieldMap,
} from "@/config/mls-fields";

export type SheetRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type GoogleCredentials = {
  client_email: string;
  private_key: string;
};

type OAuthClientConfig = {
  client_id: string;
  client_secret: string;
};

let sheetsClient: sheets_v4.Sheets | null = null;

function getSpreadsheetId() {
  return process.env.MLS_SPREADSHEET_ID || MLS_SPREADSHEET_ID;
}

function hasServiceAccountCredentials(value: unknown): value is GoogleCredentials {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GoogleCredentials>;
  return Boolean(candidate.client_email && candidate.private_key);
}

function parseServiceAccountCredentials(): GoogleCredentials | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_CREDENTIALS_JSON;
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;

  if (!raw && !encoded) return null;

  const json = raw || Buffer.from(encoded || "", "base64").toString("utf8");
  const credentials: unknown = JSON.parse(json);
  if (!hasServiceAccountCredentials(credentials)) {
    throw new Error("Google service account credentials must include client_email and private_key.");
  }
  return credentials;
}

function parseJsonObject(value: string, label: string) {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed;
}

function parseOAuthClientConfig(value: unknown): OAuthClientConfig {
  if (!value || typeof value !== "object") {
    throw new Error(
      "Google OAuth client JSON must contain an installed or web client object.",
    );
  }

  const config = value as {
    installed?: { client_id?: string; client_secret?: string };
    web?: { client_id?: string; client_secret?: string };
  };
  const client = config.installed || config.web;
  if (!client?.client_id || !client.client_secret) {
    throw new Error(
      "Google OAuth client JSON must include client_id and client_secret.",
    );
  }
  return {
    client_id: client.client_id,
    client_secret: client.client_secret,
  };
}

async function getOAuthClientConfig() {
  const fs = await import("node:fs");
  const clientJsonOrPath = process.env.GOOGLE_OAUTH_CLIENT_JSON;
  const defaultClientPath =
    "C:/Users/Inqui/Downloads/client_secret_172984887894-fao8ei9m253ll9eoi4i3k45q4i54m9s4.apps.googleusercontent.com.json";

  if (clientJsonOrPath?.trim().startsWith("{")) {
    return parseOAuthClientConfig(
      parseJsonObject(clientJsonOrPath, "GOOGLE_OAUTH_CLIENT_JSON"),
    );
  }

  if (process.env.NODE_ENV === "production") return null;

  const clientPath = clientJsonOrPath || defaultClientPath;
  if (!fs.existsSync(clientPath)) {
    throw new Error(`Google OAuth client file was not found at ${clientPath}.`);
  }

  return parseOAuthClientConfig(JSON.parse(fs.readFileSync(clientPath, "utf8")));
}

async function getOAuthToken() {
  const tokenJson = process.env.GOOGLE_OAUTH_TOKEN_JSON;
  if (tokenJson?.trim().startsWith("{")) {
    return parseJsonObject(tokenJson, "GOOGLE_OAUTH_TOKEN_JSON");
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_LOCAL_GOOGLE_OAUTH !== "true"
  ) {
    return null;
  }

  const fs = await import("node:fs");
  const tokenPath =
    process.env.GOOGLE_OAUTH_TOKEN_PATH || "../.appfolio-google-token.json";
  if (!fs.existsSync(tokenPath)) return null;

  return JSON.parse(fs.readFileSync(tokenPath, "utf8")) as Record<
    string,
    unknown
  >;
}

async function getOAuthAuth() {
  const client = await getOAuthClientConfig();
  const token = await getOAuthToken();
  if (!client || !token) return null;

  const oauth2Client = new google.auth.OAuth2(
    client.client_id,
    client.client_secret,
    "http://127.0.0.1:53682/oauth2callback",
  );
  oauth2Client.setCredentials(token);
  return oauth2Client;
}

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const credentials = parseServiceAccountCredentials();
  const auth = credentials
    ? new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      })
    : await getOAuthAuth();

  if (!auth) {
    throw new Error(
      "Configure GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CREDENTIALS_JSON, GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, GOOGLE_OAUTH_CLIENT_JSON with GOOGLE_OAUTH_TOKEN_JSON, or a local GOOGLE_OAUTH_TOKEN_PATH for MLS Sheets access.",
    );
  }

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function valuesToRows(values: string[][] | undefined, startRowNumber = 2): SheetRow[] {
  if (!values || values.length < 2) return [];
  const headers = values[0] || [];

  return values.slice(1).flatMap((row, index) => {
    const hasContent = row.some((cell, cellIndex) => {
      const header = headers[cellIndex];
      const value = String(cell || "").trim();
      if (!value) return false;
      return !(header === "Done" && value.toUpperCase() === "FALSE");
    });
    if (!hasContent) return [];

    const mapped: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      if (header) mapped[header] = row[cellIndex] || "";
    });
    return [{ rowNumber: startRowNumber + index, values: mapped }];
  });
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export async function readSheetRows(sheetName: string, range = "A1:CC2000") {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!${range}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return valuesToRows((response.data.values as string[][] | undefined) || []);
}

export async function getMlsReadyRows(query = "") {
  const rows = await readSheetRows(MLS_READY_SHEET);
  const normalized = normalizeSearch(query);

  if (!normalized) return rows;

  return rows.filter((row) => {
    const haystack = [
      row.values["Task Key"],
      row.values["Property ID"],
      row.values["Unit ID"],
      row.values.Address,
      row.values["Task Type"],
      row.values["RentCast formattedAddress"],
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export async function getTodoRows(query = "") {
  const rows = await readSheetRows(MLS_TODO_SHEET, "A1:Z200");
  const normalized = normalizeSearch(query);

  return rows
    .filter((row) => String(row.values.Done || "").toUpperCase() !== "TRUE")
    .filter((row) => {
      if (!normalized) return true;
      const haystack = [
        row.values["Task Key"],
        row.values["Property ID"],
        row.values["Unit ID"],
        row.values.Address,
        row.values["Task Type"],
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    })
    .slice(0, 30);
}

function columnLetter(index: number) {
  let value = "";
  let n = index + 1;
  while (n > 0) {
    const mod = (n - 1) % 26;
    value = String.fromCharCode(65 + mod) + value;
    n = Math.floor((n - mod) / 26);
  }
  return value;
}

async function updateReadyColumns(rowNumber: number, updates: Record<string, string>) {
  const sheets = await getSheetsClient();
  const data = Object.entries(updates).map(([column, value]) => {
    const index = mlsReadyHeaders.indexOf(column as (typeof mlsReadyHeaders)[number]);
    if (index < 0) throw new Error(`Unknown MLS_READY column: ${column}`);
    return {
      range: `${MLS_READY_SHEET}!${columnLetter(index)}${rowNumber}`,
      values: [[value]],
    };
  });

  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

async function writeReadyRow(rowNumber: number, values: Record<string, string>) {
  const sheets = await getSheetsClient();
  const row = mlsReadyHeaders.map((header) => values[header] || "");

  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${MLS_READY_SHEET}!A${rowNumber}:CC${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

function isFieldComplete(value: string | undefined) {
  return Boolean(String(value || "").trim());
}

export function missingPmFields(values: Record<string, string>) {
  return mlsPmFields.filter((field) => field.required && !isFieldComplete(values[field.sheetColumn]));
}

export async function submitPmFields(rowNumber: number, fields: Record<string, string | string[]>) {
  const rows = await getMlsReadyRows();
  const row = rows.find((candidate) => candidate.rowNumber === rowNumber);
  if (!row) throw new Error(`MLS_READY row ${rowNumber} was not found.`);

  const updates: Record<string, string> = {};
  for (const field of mlsPmFields) {
    if (!(field.key in fields)) continue;
    const rawValue = fields[field.key];
    const value = Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue || "").trim();

    if (field.options && field.type !== "multi-select" && value && !field.options.includes(value)) {
      throw new Error(`${field.label} must be one of: ${field.options.join(", ")}`);
    }

    if (field.options && field.type === "multi-select" && value) {
      const invalid = value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part && !field.options?.includes(part));
      if (invalid.length) throw new Error(`${field.label} has invalid option(s): ${invalid.join(", ")}`);
    }

    updates[field.sheetColumn] = value;
    row.values[field.sheetColumn] = value;
  }

  const missing = missingPmFields(row.values);
  updates["PM Fields Status"] = missing.length === 0 ? "Complete" : "Needs PM";
  updates.MLS_READY = missing.length === 0 ? "Yes" : "No";
  updates["Ready Row Updated At"] = new Date().toISOString();
  updates["Ready Source"] = row.values["Ready Source"] || "PM App";
  updates["PM Submitted At"] = new Date().toISOString();

  await updateReadyColumns(rowNumber, updates);
  return { rowNumber, missing: missing.map((field) => field.sheetColumn), updates };
}

function placeholderRentCast(todo: Record<string, string>) {
  const address = todo.Address || "";
  const cityStateZip = address.match(/([^,]+),?\s+([A-Z]{2})\s+(\d{5})$/i);
  const isJacksonville = /jacksonville/i.test(address);
  const placeholderCity = isJacksonville ? "Jacksonville" : cityStateZip?.[1]?.trim() || "";
  return {
    "RentCast Status": "Placeholder",
    "RentCast Updated At": new Date().toISOString(),
    "RentCast formattedAddress": address,
    "RentCast addressLine1": address.replace(/\s+[A-Za-z .'-]+,\s+[A-Z]{2}\s+\d{5}$/i, ""),
    "RentCast city": placeholderCity,
    "RentCast state": cityStateZip?.[2]?.toUpperCase() || "",
    "RentCast zipCode": cityStateZip?.[3] || "",
    "RentCast county": isJacksonville ? "Duval" : "",
    "RentCast propertyType": "Single Family",
    "RentCast bedrooms": "3",
    "RentCast bathrooms": "2",
    "RentCast squareFootage": "1600",
    "RentCast yearBuilt": "2000",
    "RentCast floorCount": "1",
    "RentCast garage": "true",
    "RentCast garageSpaces": "2",
    "RentCast Raw JSON": JSON.stringify({ source: "manual-dev-placeholder", address }),
  };
}

export function mapRentCastToReadyFields(rentCast: Record<string, unknown>) {
  const mapped: Record<string, string> = {};

  for (const [rentCastPath, sheetColumn] of Object.entries(rentCastFieldMap)) {
    const value = rentCastPath.split(".").reduce<unknown>((current, part) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[part];
    }, rentCast);

    if (value != null) mapped[sheetColumn] = String(value);
  }

  mapped["RentCast Raw JSON"] = JSON.stringify(rentCast);
  mapped["RentCast Status"] = "Enriched";
  mapped["RentCast Updated At"] = new Date().toISOString();
  return mapped;
}

export async function createDevReadyRowFromTodo(todoRowNumber: number) {
  const todoRows = await getTodoRows();
  const todo = todoRows.find((row) => row.rowNumber === todoRowNumber);
  if (!todo) throw new Error(`MLS_TODO row ${todoRowNumber} was not found in the active intake list.`);

  const existing = (await getMlsReadyRows()).find((row) => row.values["Task Key"] === todo.values["Task Key"]);
  if (existing) return { rowNumber: existing.rowNumber, created: false };

  const now = new Date().toISOString();
  const rowValues: Record<string, string> = {
    Done: "FALSE",
    "Task Key": todo.values["Task Key"] || "",
    "Date Created": todo.values["Date Created"] || "",
    "Last Seen": todo.values["Last Seen"] || "",
    "Property ID": todo.values["Property ID"] || "",
    "Unit ID": todo.values["Unit ID"] || "",
    Address: todo.values.Address || "",
    "Task Type": todo.values["Task Type"] || "",
    "Old Value": todo.values["Old Value"] || "",
    "New Value": todo.values["New Value"] || "",
    Notes: todo.values.Notes || "",
    "Ready Row Created At": now,
    "Ready Row Updated At": now,
    "Ready Source": "Manual Dev Seed",
    "PM Fields Status": "Needs PM",
    MLS_READY: "No",
    "Bot Status": "Queued",
    "Dev Seed": "Yes",
    "Source TODO Row": String(todoRowNumber),
    ...placeholderRentCast(todo.values),
  };

  const readyRows = await getMlsReadyRows();
  const occupiedRows = new Set(readyRows.map((row) => row.rowNumber));
  let targetRowNumber = 2;
  while (occupiedRows.has(targetRowNumber)) targetRowNumber += 1;

  await writeReadyRow(targetRowNumber, rowValues);

  return { rowNumber: targetRowNumber, created: true };
}
