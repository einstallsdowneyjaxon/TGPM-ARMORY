"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { mlsPmFields, splitMultiSelect, type MlsPmField } from "@/config/mls-fields";

type ReadyRow = {
  rowNumber: number;
  values: Record<string, string>;
  missingFields: string[];
};

type TodoRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type MlsReadyResponse = {
  fields: MlsPmField[];
  readyRows: ReadyRow[];
  todoRows: TodoRow[];
  error?: string;
};

function valueLabel(row: ReadyRow | TodoRow) {
  const address = row.values.Address || "Unknown address";
  const task = row.values["Task Type"] || "MLS task";
  return `${address} - ${task}`;
}

function suggestionFor(row: ReadyRow, field: MlsPmField) {
  const suggestions = (field.rentCastSuggestionKeys || [])
    .map((key) => row.values[key])
    .filter(Boolean);

  if (suggestions.length === 0) return "";

  if (field.sheetColumn === "Association Y/N") {
    return /true|yes|hoa/i.test(suggestions.join(" ")) ? "Yes" : "No";
  }

  if (field.sheetColumn === "Garage + Carport") {
    const text = suggestions.join(" ").toLowerCase();
    if (text.includes("carport")) return "Carport";
    if (text.includes("garage") || text === "true") return "Garage";
    return "Neither";
  }

  if (field.sheetColumn === "Association Amenities") {
    return /pool/i.test(suggestions.join(" ")) ? "Pool" : "";
  }

  if (field.sheetColumn === "Cooling") {
    return /wall|window/i.test(suggestions.join(" ")) ? "Wall/Window Unit(s)" : "Central Air";
  }

  if (field.sheetColumn === "Heating") {
    return /heat pump/i.test(suggestions.join(" ")) ? "Heat Pump" : "Other";
  }

  return suggestions[0] || "";
}

function initialFieldValue(row: ReadyRow, field: MlsPmField) {
  return row.values[field.sheetColumn] || suggestionFor(row, field) || "";
}

export default function MlsReadyPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<MlsReadyResponse | null>(null);
  const [selectedRowNumber, setSelectedRowNumber] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({});
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadRows(search = query) {
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/mls-ready?query=${encodeURIComponent(search)}`, { cache: "no-store" });
    const payload = (await response.json()) as MlsReadyResponse;
    if (!response.ok) throw new Error(payload.error || "Could not load MLS rows.");
    setData(payload);
    if (!selectedRowNumber && payload.readyRows.length > 0) {
      setSelectedRowNumber(payload.readyRows[0].rowNumber);
    }
    setLoading(false);
  }

  useEffect(() => {
    // The page is a client-side operator console; the first load is intentionally triggered after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRows("").catch((error: Error) => {
      setStatus(error.message);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRow = useMemo(() => {
    return data?.readyRows.find((row) => row.rowNumber === selectedRowNumber) || null;
  }, [data, selectedRowNumber]);

  const missingFields = useMemo(() => selectedRow?.missingFields || [], [selectedRow]);

  function currentFieldValue(field: MlsPmField) {
    const existing = formValues[field.key];
    if (existing !== undefined) return existing;
    if (!selectedRow) return field.type === "multi-select" ? [] : "";
    const value = initialFieldValue(selectedRow, field);
    return field.type === "multi-select" ? splitMultiSelect(value) : value;
  }
  const visibleFields = useMemo(() => {
    if (!selectedRow) return [];
    const missing = new Set(missingFields);
    const fields = mlsPmFields.filter((field) => missing.has(field.sheetColumn));
    return fields.length > 0 ? fields : mlsPmFields;
  }, [missingFields, selectedRow]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    try {
      await loadRows(query);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Search failed.");
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedRow) return;
    setStatus("Saving MLS_READY row...");
    const submissionFields = Object.fromEntries(
      mlsPmFields.map((field) => [field.key, currentFieldValue(field)]),
    );
    const response = await fetch("/api/mls-ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowNumber: selectedRow.rowNumber, fields: submissionFields }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error || "Could not save PM fields.");
      return;
    }
    if (payload.botTrigger && !payload.botTrigger.ok) {
      setStatus(payload.botTrigger.warning || "Saved, but bot did not start.");
    } else {
      setStatus(payload.missing?.length ? `Saved. Still missing: ${payload.missing.join(", ")}` : "Saved. MLS_READY is Yes.");
    }
    await loadRows(query);
  }

  async function handleDevSeed(todoRowNumber: number) {
    setStatus("Creating MLS_READY dev row...");
    const response = await fetch("/api/mls-ready/dev-seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todoRowNumber }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error || "Could not create dev row.");
      return;
    }
    setStatus(payload.created ? "Created MLS_READY dev row." : "MLS_READY row already exists.");
    setSelectedRowNumber(payload.rowNumber || null);
    await loadRows(query);
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="border-b border-cyan-200/10 pb-5">
          <Link href="/" className="text-sm font-medium text-cyan-300">
            TGPM Armory
          </Link>
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">MLS Ready Queue</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Complete PM-only MLS fields directly on the `MLS_READY` working tab. RentCast values are suggestions;
                submitted PM values are the bot input.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-slate-400">Ready rows</p>
                <p className="mt-1 text-xl font-semibold">{data?.readyRows.length || 0}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-slate-400">Intake rows</p>
                <p className="mt-1 text-xl font-semibold">{data?.todoRows.length || 0}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-slate-400">Status</p>
                <p className="mt-1 text-sm font-semibold">{selectedRow?.values.MLS_READY || "No row"}</p>
              </div>
            </div>
          </div>
        </header>

        <form onSubmit={handleSearch} className="py-5">
          <label htmlFor="mls-search" className="text-sm font-medium text-slate-300">
            Search MLS_READY
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="mls-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Address, task key, property ID, unit ID"
              className="h-12 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
            />
            <button className="h-12 rounded-lg bg-cyan-300 px-5 text-sm font-semibold text-[#07111f] hover:bg-cyan-200">
              Search
            </button>
          </div>
        </form>

        {status ? (
          <div className="mb-5 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {status}
          </div>
        ) : null}

        <section className="grid flex-1 gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5">
            <div className="rounded-lg border border-white/10 bg-[#101d31]">
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="font-semibold text-white">Working Rows</h2>
              </div>
              <div className="max-h-[430px] overflow-auto">
                {loading ? <p className="px-4 py-4 text-sm text-slate-400">Loading...</p> : null}
                {data?.readyRows.map((row) => (
                  <button
                    key={row.rowNumber}
                    type="button"
                    onClick={() => setSelectedRowNumber(row.rowNumber)}
                    className={`block w-full border-b border-white/10 px-4 py-3 text-left text-sm transition hover:bg-white/[0.05] ${
                      row.rowNumber === selectedRowNumber ? "bg-cyan-300/10" : ""
                    }`}
                  >
                    <span className="block font-medium text-white">{valueLabel(row)}</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      Row {row.rowNumber} - {row.values["PM Fields Status"] || "Needs PM"} - Ready {row.values.MLS_READY || "No"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#101d31]">
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="font-semibold text-white">Manual Dev Seed</h2>
                <p className="mt-1 text-xs text-slate-400">Create an MLS_READY row from intake with placeholder enrichment.</p>
              </div>
              <div className="max-h-[330px] overflow-auto">
                {data?.todoRows.map((row) => (
                  <div key={row.rowNumber} className="border-b border-white/10 px-4 py-3 text-sm">
                    <p className="font-medium text-white">{valueLabel(row)}</p>
                    <p className="mt-1 text-xs text-slate-400">MLS_TODO row {row.rowNumber}</p>
                    <button
                      type="button"
                      onClick={() => handleDevSeed(row.rowNumber)}
                      className="mt-3 h-9 rounded-md border border-cyan-300/40 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10"
                    >
                      Create MLS_READY Row
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="rounded-lg border border-white/10 bg-[#101d31]">
            {selectedRow ? (
              <form onSubmit={handleSubmit}>
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-sm font-medium text-cyan-300">Row {selectedRow.rowNumber}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">{selectedRow.values.Address}</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {selectedRow.values["Task Key"]} - {selectedRow.values["Task Type"]} - {selectedRow.values.Notes}
                  </p>
                </div>

                <div className="grid gap-0 border-b border-white/10 md:grid-cols-2">
                  <div className="border-b border-white/10 p-5 md:border-b-0 md:border-r">
                    <h3 className="font-semibold text-white">Current Sheet Data</h3>
                    <dl className="mt-3 grid gap-2 text-sm">
                      {["Property ID", "Unit ID", "Old Value", "New Value", "Bot Status", "Last Error"].map((key) => (
                        <div key={key} className="grid grid-cols-[140px_1fr] gap-3">
                          <dt className="text-slate-400">{key}</dt>
                          <dd className="text-slate-200">{selectedRow.values[key] || "-"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-white">RentCast Suggestions</h3>
                    <dl className="mt-3 grid gap-2 text-sm">
                      {[
                        "RentCast formattedAddress",
                        "RentCast propertyType",
                        "RentCast bedrooms",
                        "RentCast bathrooms",
                        "RentCast squareFootage",
                        "RentCast yearBuilt",
                        "RentCast subdivision",
                        "RentCast garageSpaces",
                      ].map((key) => (
                        <div key={key} className="grid grid-cols-[170px_1fr] gap-3">
                          <dt className="text-slate-400">{key.replace("RentCast ", "")}</dt>
                          <dd className="text-slate-200">{selectedRow.values[key] || "-"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex flex-col gap-1">
                    <h3 className="font-semibold text-white">
                      {missingFields.length ? "Missing Required PM Fields" : "PM Fields"}
                    </h3>
                    <p className="text-sm text-slate-400">
                      Multi-select fields save as comma-separated option labels in MLS_READY.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {visibleFields.map((field) => {
                      const suggestion = selectedRow ? suggestionFor(selectedRow, field) : "";
                      const currentValue = currentFieldValue(field);

                      return (
                        <label key={field.key} className="block">
                          <span className="text-sm font-medium text-slate-200">{field.label}</span>
                          {field.type === "dropdown" ? (
                            <select
                              value={String(currentValue || "")}
                              onChange={(event) =>
                                setFormValues((previous) => ({ ...previous, [field.key]: event.target.value }))
                              }
                              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-3 text-sm text-white outline-none focus:border-cyan-300"
                            >
                              <option value="">Select one</option>
                              {field.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : field.type === "multi-select" ? (
                            <div className="mt-2 grid gap-2 rounded-lg border border-white/10 bg-[#0e1a2c] p-3">
                              {field.options?.map((option) => {
                                const values = Array.isArray(currentValue) ? currentValue : splitMultiSelect(String(currentValue || ""));
                                return (
                                  <label key={option} className="flex items-center gap-2 text-sm text-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={values.includes(option)}
                                      onChange={(event) => {
                                        const next = event.target.checked
                                          ? [...values, option]
                                          : values.filter((value) => value !== option);
                                        setFormValues((previous) => ({ ...previous, [field.key]: next }));
                                      }}
                                    />
                                    {option}
                                  </label>
                                );
                              })}
                            </div>
                          ) : field.type === "text" ? (
                            <textarea
                              value={String(currentValue || "")}
                              onChange={(event) =>
                                setFormValues((previous) => ({ ...previous, [field.key]: event.target.value }))
                              }
                              rows={4}
                              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                            />
                          ) : (
                            <input
                              type="number"
                              value={String(currentValue || "")}
                              onChange={(event) =>
                                setFormValues((previous) => ({ ...previous, [field.key]: event.target.value }))
                              }
                              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-3 text-sm text-white outline-none focus:border-cyan-300"
                            />
                          )}
                          {suggestion ? <span className="mt-1 block text-xs text-cyan-200">RentCast suggestion: {suggestion}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setFormValues({})}
                    className="h-11 rounded-lg border border-white/10 px-4 text-sm font-semibold text-slate-200 hover:bg-white/[0.05]"
                  >
                    Reset
                  </button>
                  <button className="h-11 rounded-lg bg-cyan-300 px-5 text-sm font-semibold text-[#07111f] hover:bg-cyan-200">
                    Submit to MLS_READY
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
                <div>
                  <h2 className="text-xl font-semibold text-white">No MLS_READY row selected</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Search for a working row or create a dev row from MLS_TODO.
                  </p>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
