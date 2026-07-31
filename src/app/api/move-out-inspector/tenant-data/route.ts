import { NextResponse } from "next/server";
import Papa from "papaparse";

export const runtime = "nodejs";

// Sheet must be set to "Anyone with the link can view"
const SHEET_ID =
  process.env.UNIT_DIRECTORY_SPREADSHEET_ID ||
  "1Bt7qKse7LFT1bRs3dqvZSsA7gnZkJJ6yj7WYNmvrN1o";

function col(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const val = row[name]?.trim();
    if (val) return val;
  }
  return "";
}

export async function GET() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            "Could not fetch tenant directory. Make sure the sheet is set to 'Anyone with the link can view'.",
          records: [],
        },
        { status: 502 },
      );
    }

    const csv = await res.text();

    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    const records = parsed.data
      .filter((row) =>
        col(row, "Property Address", "Tenant Address", "FullAddress"),
      )
      .map((row) => ({
        address: col(row, "Property Address", "Tenant Address", "FullAddress"),
        firstName: col(row, "First Name"),
        lastName: col(row, "Last Name"),
        moveIn: col(row, "Move-in", "Move In", "MoveIn"),
        moveOut: col(row, "Move-out", "Move Out", "MoveOut"),
        deposit: col(row, "Deposit"),
        status: col(row, "Status"),
        tenantNotes: col(row, "Tenant Notes"),
      }));

    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load tenant directory.",
        records: [],
      },
      { status: 500 },
    );
  }
}
