import { NextRequest, NextResponse } from "next/server";
import { mlsPmFields } from "@/config/mls-fields";
import { getMlsReadyRows, getTodoRows, missingPmFields, submitPmFields } from "@/lib/mls-sheets";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query") || "";
    const [readyRows, todoRows] = await Promise.all([getMlsReadyRows(query), getTodoRows(query)]);

    return NextResponse.json({
      fields: mlsPmFields,
      readyRows: readyRows.map((row) => ({
        ...row,
        missingFields: missingPmFields(row.values).map((field) => field.sheetColumn),
      })),
      todoRows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load MLS_READY rows." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { rowNumber?: number; fields?: Record<string, string | string[]> };
    if (!body.rowNumber || !body.fields) {
      return NextResponse.json({ error: "Provide rowNumber and fields." }, { status: 400 });
    }

    const result = await submitPmFields(body.rowNumber, body.fields);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update MLS_READY." },
      { status: 500 },
    );
  }
}
