"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MatterPayload = {
  matter: {
    id: string;
    title: string;
    case_number: string | null;
    court_name: string | null;
    county: string | null;
    plaintiff: string | null;
    defendant: string | null;
    property_address: string | null;
    public_docket_url: string | null;
    intake_summary: string | null;
    florida_research: string | null;
    proposed_next_steps: string | null;
    analysis_disclaimer: string;
    docket_last_checked_at: string | null;
  };
  courtDates: Array<{
    id: string;
    label: string;
    event_at: string;
    timezone: string;
  }>;
  docketEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    filed_at: string | null;
    source: string;
    detected_at: string;
  }>;
  documents: Array<{
    id: string;
    file_name: string;
    doc_role: string;
    uploaded_at: string;
  }>;
};

export default function LegalMatterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [matterId, setMatterId] = useState("");
  const [data, setData] = useState<MatterPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void params.then((value) => setMatterId(value.id));
  }, [params]);

  useEffect(() => {
    if (!matterId) return;

    async function load() {
      try {
        const response = await fetch(`/api/legal-intake/matters/${matterId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as MatterPayload & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load matter.");
        }
        setData(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load matter.",
        );
      }
    }

    void load();
  }, [matterId]);

  if (error) {
    return (
      <main className="min-h-screen bg-[#08111f] px-4 py-8 text-rose-100">
        {error}
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#08111f] px-4 py-8 text-slate-300">
        Loading matter...
      </main>
    );
  }

  const matter = data.matter;

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/legal-intake" className="text-sm text-cyan-300">
          ← New intake
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-white">{matter.title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {matter.case_number ? `Case # ${matter.case_number}` : "Case number pending"}
          {matter.court_name ? ` · ${matter.court_name}` : ""}
          {matter.county ? ` · ${matter.county} County, FL` : ""}
        </p>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-white/10 bg-[#101d31] p-5">
            <h2 className="text-lg font-semibold text-white">Intake summary</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {matter.intake_summary || "No summary yet."}
            </p>
          </article>
          <article className="rounded-lg border border-white/10 bg-[#101d31] p-5">
            <h2 className="text-lg font-semibold text-white">Court dates</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {data.courtDates.length === 0 ? (
                <li>No court dates extracted yet.</li>
              ) : (
                data.courtDates.map((date) => (
                  <li key={date.id}>
                    <strong className="text-white">{date.label}</strong>:{" "}
                    {new Date(date.event_at).toLocaleString("en-US", {
                      timeZone: date.timezone || "America/New_York",
                    })}{" "}
                    ({date.timezone})
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className="rounded-lg border border-white/10 bg-[#101d31] p-5">
            <h2 className="text-lg font-semibold text-white">
              Florida research (AI)
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {matter.florida_research || "No research generated."}
            </p>
          </article>
          <article className="rounded-lg border border-amber-300/20 bg-[#101d31] p-5">
            <h2 className="text-lg font-semibold text-amber-200">
              Proposed next steps (AI)
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {matter.proposed_next_steps || "No recommendations generated."}
            </p>
            <p className="mt-4 text-xs text-slate-400">
              {matter.analysis_disclaimer}
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-lg border border-white/10 bg-[#101d31] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Mini docket</h2>
            {matter.public_docket_url ? (
              <a
                href={matter.public_docket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Open public docket
              </a>
            ) : null}
          </div>
          {matter.docket_last_checked_at ? (
            <p className="mt-1 text-xs text-slate-500">
              Last auto-check:{" "}
              {new Date(matter.docket_last_checked_at).toLocaleString()}
            </p>
          ) : null}
          <ul className="mt-4 space-y-3">
            {data.docketEvents.length === 0 ? (
              <li className="text-sm text-slate-400">No docket entries yet.</li>
            ) : (
              data.docketEvents.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-white/10 bg-[#0e1a2c] p-3 text-sm"
                >
                  <p className="font-semibold text-white">{entry.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {entry.source}
                    {entry.filed_at ? ` · filed ${entry.filed_at}` : ""}
                  </p>
                  {entry.description ? (
                    <p className="mt-2 text-slate-300">{entry.description}</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mt-8 rounded-lg border border-white/10 bg-[#101d31] p-5">
          <h2 className="text-lg font-semibold text-white">Uploaded files</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {data.documents.map((doc) => (
              <li key={doc.id}>
                {doc.file_name}{" "}
                <span className="text-xs text-slate-500">({doc.doc_role})</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
