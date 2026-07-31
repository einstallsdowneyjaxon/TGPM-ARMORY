import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/mls-sheets";

export const runtime = "nodejs";

// Configure via Vercel environment variables:
//   UNIT_DIRECTORY_SPREADSHEET_ID  – spreadsheet containing the unit directory
//                                    (defaults to MLS_SPREADSHEET_ID if not set)
//   UNIT_DIRECTORY_SHEET_NAME      – sheet/tab name (default: "Unit Directory")
//   UNIT_DIRECTORY_ADDRESS_COLUMN  – address column header (default: auto-detect)

function candidateAddressColumns(headers: string[]) {
  const configured = process.env.UNIT_DIRECTORY_ADDRESS_COLUMN;
  if (configured && headers.includes(configured)) return [configured];
  const preferred = [
    "Tenant Address",
    "FullAddress",
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
    const sheets = await getSheetsClient();

    const spreadsheetId =
      process.env.UNIT_DIRECTORY_SPREADSHEET_ID ||
      "1Bt7qKse7LFT1bRs3dqvZSsA7gnZkJJ6yj7WYNmvrN1o";
    const sheetName =
      process.env.UNIT_DIRECTORY_SHEET_NAME || "Sheet1";

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

    return NextResponse.json({ addresses: Array.from(matches).slice(0, 10) });
  } catch {
    return NextResponse.json({ addresses: [] });
  }
}
