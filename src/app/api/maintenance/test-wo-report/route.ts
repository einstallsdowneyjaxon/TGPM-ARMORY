import { NextResponse } from "next/server";

export const runtime = "nodejs";
const REPORT_UUID = "992bd507-8ef4-11f1-a5fc-0e19822e78a7";

export async function GET() {
  try {
    const vhost = (process.env.APPFOLIO_VHOST ?? "").trim().replace(/^https?:\/\//, "");
    const clientId = (process.env.APPFOLIO_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.APPFOLIO_CLIENT_SECRET ?? "").trim();
    if (!vhost || !clientId || !clientSecret) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 503 });
    }
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const url = `https://${vhost}/api/v2/reports/saved/${REPORT_UUID}.json?limit=3`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    });
    const body = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `AppFolio ${res.status}`, body: body.slice(0, 300) }, { status: 502 });
    }
    const data = JSON.parse(body) as { results?: Record<string, unknown>[]; next_page_url?: string | null };
    const rows = data.results ?? [];
    return NextResponse.json({
      rowCount: rows.length,
      next_page_url: data.next_page_url,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      firstRow: rows[0] ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
