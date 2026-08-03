import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TENANT_DIRECTORY_UUID = "1f40875c-8f63-11f1-a5fc-0e19822e78a7";

export async function GET() {
  try {
    const vhost = process.env.APPFOLIO_VHOST;
    const clientId = process.env.APPFOLIO_CLIENT_ID;
    const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;

    if (!vhost || !clientId || !clientSecret) {
      return NextResponse.json({ error: "Missing AppFolio credentials." }, { status: 503 });
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const url = `https://${vhost}/api/v2/reports/saved/${TENANT_DIRECTORY_UUID}.json?limit=5`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
    });

    const body = await res.text();

    if (!res.ok) {
      return NextResponse.json({
        error: `AppFolio returned ${res.status}`,
        body: body.slice(0, 500),
      }, { status: 502 });
    }

    const data = JSON.parse(body) as unknown;
    const rows = (data as { results?: Record<string, unknown>[] }).results
      ?? (Array.isArray(data) ? data as Record<string, unknown>[] : []);

    const columns = rows[0] ? Object.keys(rows[0]) : [];

    return NextResponse.json({
      status: res.status,
      rowCount: rows.length,
      columns,
      sampleRow: rows[0] ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unexpected error.",
    }, { status: 500 });
  }
}
