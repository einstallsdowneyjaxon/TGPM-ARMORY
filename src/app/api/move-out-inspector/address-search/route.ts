import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

// Configure via env vars:
//   UNIT_DIRECTORY_SPREADSHEET_ID  – spreadsheet containing the unit directory
//   UNIT_DIRECTORY_SHEET_NAME      – sheet/tab name (default: "Unit Directory")
//   UNIT_DIRECTORY_ADDRESS_COLUMN  – column header to use as address (default: auto-detect)
//
// Authentication reuses the same GOOGLE_SERVICE_ACCOUNT_JSON /
// GOOGLE_CREDENTIALS_JSON / GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 env vars
// already used by the MLS Sheets integration.

type GoogleCredentials = {
  client_email: string;
  private_key: string;
};

function parseServiceAccountCredentials(): GoogleCredentials | null {
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_CREDENTIALS_JSON;
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!raw && !encoded) return null;
  const json = raw || Buffer.from(encoded ?? "", "base64").toString("utf8");
  const parsed = JSON.parse(json) as Partial<GoogleCredentials>;
  if (!parsed.client_email || !parsed.private_key) return null;
  return parsed as GoogleCredentials;
}

function candidateAddressColumns(headers: string[]) {
  const configured = process.env.UNIT_DIRECTORY_ADDRESS_COLUMN;
  if (configured && headers.includes(configured)) return [configured];
  const preferred = [
    "Property Address",
    "Address",
    "Full Address",
    "Unit Address",
    "Street Address",
  ];
  return preferred.filter((col) => headers.includes(col));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (!query || query.length < 2) {
    return NextResponse.json({ addresses: [] });
  }

  try {
    const credentials = parseServiceAccountCredentials();
    if (!credentials) {
      return NextResponse.json({ addresses: [] });
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId =
      process.env.UNIT_DIRECTORY_SPREADSHEET_ID ||
      process.env.MLS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return NextResponse.json({ addresses: [] });
    }

    const sheetName =
      process.env.UNIT_DIRECTORY_SHEET_NAME || "Unit Directory";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:ZZ5000`,
      valueRenderOption: "FORMATTED_VALUE",
    });

    const values = response.data.values as string[][] | undefined;
    if (!values || values.length < 2) {
      return NextResponse.json({ addresses: [] });
    }

    const headers = (values[0] ?? []) as string[];
    const addressColumns = candidateAddressColumns(headers);

    if (addressColumns.length === 0) {
      return NextResponse.json({ addresses: [] });
    }

    const addressColumnIndices = addressColumns.map((col) =>
      headers.indexOf(col),
    );

    const matches = new Set<string>();
    for (const row of values.slice(1)) {
      const rowText = row.join(" ").toLowerCase();
      if (!rowText.includes(query)) continue;
      for (const idx of addressColumnIndices) {
        const val = String(row[idx] ?? "").trim();
        if (val) matches.add(val);
      }
    }

    const addresses = Array.from(matches).slice(0, 10);
    return NextResponse.json({ addresses });
  } catch {
    return NextResponse.json({ addresses: [] });
  }
}
