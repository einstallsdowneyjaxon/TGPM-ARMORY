import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TENANT_DIRECTORY_UUID = "1f40875c-8f63-11f1-a5fc-0e19822e78a7";

export async function GET() {
  try {
    const vhost = process.env.APPFOLIO_VHOST;
    const clientId = process.env.APPFOLIO_CLIENT_ID;
    const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;

    // Diagnostic — show exactly what we have (masked)
    const diagnostics = {
      vhost_set: !!vhost,
      vhost_value: vhost ? `"${vhost.slice(0, 30)}..." (len=${vhost.length})` : "MISSING",
      vhost_has_protocol: vhost?.startsWith("http"),
      vhost_trimmed_differs: vhost !== vhost?.trim(),
      clientId_set: !!clientId,
      clientSecret_set: !!clientSecret,
      constructed_url: vhost
        ? `https://${vhost.trim()}/api/v2/reports/saved/${TENANT_DIRECTORY_UUID}.json?limit=5`
        : "CANNOT_BUILD_URL",
    };

    if (!vhost || !clientId || !clientSecret) {
      return NextResponse.json({ error: "Missing credentials", diagnostics });
    }

    const cleanVhost = vhost.trim().replace(/^https?:\/\//, "");
    const url = `https://${cleanVhost}/api/v2/reports/saved/${TENANT_DIRECTORY_UUID}.json?limit=5`;
    const credentials = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64");

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
        body: body.slice(0, 300),
        diagnostics,
      }, { status: 502 });
    }

    const data = JSON.parse(body) as unknown;
    const rows = (data as { results?: Record<string, unknown>[] }).results
      ?? (Array.isArray(data) ? data as Record<string, unknown>[] : []);

    return NextResponse.json({
      status: res.status,
      rowCount: rows.length,
      columns: rows[0] ? Object.keys(rows[0]) : [],
      sampleRow: rows[0] ?? null,
      diagnostics,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Unexpected error.",
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    }, { status: 500 });
  }
}
