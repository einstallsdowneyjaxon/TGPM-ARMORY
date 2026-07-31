"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InspectionResult, IssueCard, ListItem } from "@/lib/inspection-parser";

// ─── Tenant directory types ───────────────────────────────────────────────────

type TenantRecord = {
  address: string;
  firstName: string;
  lastName: string;
  moveIn: string;
  moveOut: string;
  deposit: string;
  status: string;
  tenantNotes: string;
};

function parseTenantCsv(text: string): TenantRecord[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data
    .filter((row) => row["Tenant Address"]?.trim())
    .map((row) => ({
      address: row["Tenant Address"]?.trim() ?? "",
      firstName: row["First Name"]?.trim() ?? "",
      lastName: row["Last Name"]?.trim() ?? "",
      moveIn: row["Move-in"]?.trim() ?? "",
      moveOut: row["Move-out"]?.trim() ?? "",
      deposit: row["Deposit"]?.trim() ?? "",
      status: row["Status"]?.trim() ?? "",
      tenantNotes: row["Tenant Notes"]?.trim() ?? "",
    }));
}

function lookupTenant(
  records: TenantRecord[],
  propertyAddress: string,
): TenantRecord | null {
  if (!records.length || !propertyAddress) return null;
  const needle = propertyAddress.toLowerCase().replace(/[^\w\s]/g, "").trim();

  let best: TenantRecord | null = null;
  let bestScore = 0;

  for (const rec of records) {
    const hay = rec.address.toLowerCase().replace(/[^\w\s]/g, "").trim();
    // Score by longest matching prefix of address words
    const needleWords = needle.split(/\s+/);
    const hayWords = hay.split(/\s+/);
    let match = 0;
    for (const w of needleWords) {
      if (hayWords.some((hw) => hw.startsWith(w) || w.startsWith(hw))) match++;
    }
    const score = match / Math.max(needleWords.length, 1);
    if (score > bestScore) {
      bestScore = score;
      best = rec;
    }
  }

  return bestScore >= 0.6 ? best : null;
}

function searchAddresses(records: TenantRecord[], query: string): string[] {
  const q = query.toLowerCase();
  return records
    .filter((r) => r.address.toLowerCase().includes(q))
    .slice(0, 10)
    .map((r) => r.address);
}

// ─── Address autocomplete ─────────────────────────────────────────────────────

function AddressSearch({
  value,
  onChange,
  tenantRecords,
}: {
  value: string;
  onChange: (v: string) => void;
  tenantRecords: TenantRecord[];
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      // If tenant CSV is loaded, search locally — instant and reliable
      if (tenantRecords.length > 0) {
        const results = searchAddresses(tenantRecords, q);
        setSuggestions(results);
        setOpen(results.length > 0);
        return;
      }
      // Fall back to Sheets API
      try {
        const res = await fetch(
          `/api/move-out-inspector/address-search?q=${encodeURIComponent(q)}`,
        );
        const data = (await res.json()) as { addresses: string[] };
        setSuggestions(data.addresses ?? []);
        setOpen((data.addresses ?? []).length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    },
    [tenantRecords],
  );

  function handleChange(v: string) {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(v), 150);
  }

  function select(address: string) {
    onChange(address);
    setSuggestions([]);
    setOpen(false);
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={
          tenantRecords.length > 0
            ? `Search ${tenantRecords.length} properties…`
            : "Search property address (optional)"
        }
        className="h-12 w-full rounded-lg border border-[#eadfd5] bg-white px-4 text-base text-[#1d2430] shadow-sm outline-none transition placeholder:text-[#a0a0a0] focus:border-[#f05a28] focus:ring-2 focus:ring-[#f05a28]/20"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#eadfd5] bg-white shadow-lg">
          {suggestions.map((addr) => (
            <li key={addr}>
              <button
                type="button"
                onMouseDown={() => select(addr)}
                className="w-full px-4 py-3 text-left text-sm text-[#1d2430] transition hover:bg-[#fff4ed] hover:text-[#b74119]"
              >
                {addr}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── PDF upload zone ──────────────────────────────────────────────────────────

function PdfUploadZone({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.toLowerCase().endsWith(".pdf")) onFile(dropped);
  }

  return (
    <div
      className={`relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition ${
        dragging
          ? "border-[#f05a28] bg-[#fff4ed]"
          : file
            ? "border-[#f05a28]/50 bg-[#fff8f4]"
            : "border-[#d9cec2] bg-white hover:border-[#f05a28]/50"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        onClick={(e) => e.stopPropagation()}
      />
      {file ? (
        <>
          <PdfIcon className="h-8 w-8 text-[#f05a28]" />
          <p className="mt-2 text-sm font-semibold text-[#b74119]">
            {file.name}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            {(file.size / 1024).toFixed(0)} KB — click to replace
          </p>
        </>
      ) : (
        <>
          <UploadIcon className="h-8 w-8 text-[#d9cec2]" />
          <p className="mt-2 text-sm font-semibold text-[#344054]">{label}</p>
          <p className="mt-1 text-xs text-[#667085]">
            Click to browse or drag and drop a PDF
          </p>
        </>
      )}
    </div>
  );
}

// ─── Tenant info banner ───────────────────────────────────────────────────────

function TenantInfoBanner({ tenant }: { tenant: TenantRecord }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const fullName = [tenant.firstName, tenant.lastName].filter(Boolean).join(" ");
  return (
    <div className="mt-3 rounded-lg border border-[#eadfd5] bg-[#fff8f4] px-4 py-3 text-sm">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {fullName ? (
          <span>
            <span className="font-medium text-[#344054]">Tenant: </span>
            <span className="font-semibold text-[#101828]">{fullName}</span>
          </span>
        ) : null}
        {tenant.moveIn ? (
          <span>
            <span className="font-medium text-[#344054]">Move-In: </span>
            <span className="text-[#101828]">{tenant.moveIn}</span>
          </span>
        ) : null}
        {tenant.moveOut ? (
          <span>
            <span className="font-medium text-[#344054]">Move-Out: </span>
            <span className="text-[#101828]">{tenant.moveOut}</span>
          </span>
        ) : null}
        {tenant.deposit ? (
          <span>
            <span className="font-medium text-[#344054]">Deposit on File: </span>
            <span className="font-semibold text-[#101828]">${tenant.deposit}</span>
          </span>
        ) : null}
        {tenant.status ? (
          <span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                tenant.status === "Current"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {tenant.status}
            </span>
          </span>
        ) : null}
      </div>
      {tenant.tenantNotes ? (
        <div className="mt-2 border-t border-[#eadfd5] pt-2">
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#b74119] transition hover:text-[#8c2d12]"
          >
            <ChevronIcon collapsed={!notesOpen} className="h-3.5 w-3.5" />
            Tenant Notes
          </button>
          {notesOpen ? (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#475467]">
              {tenant.tenantNotes}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Issue card ───────────────────────────────────────────────────────────────

function IssueCardView({ card }: { card: IssueCard }) {
  const isNew = card.moveInComment === "";
  return (
    <div className="rounded-lg border border-[#eadfd5] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
        {card.room}
      </p>
      <p className="mt-0.5 text-base font-semibold text-[#101828]">
        {card.issue}
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <div>
          <span className="font-medium text-[#344054]">Move-in: </span>
          {isNew ? (
            <span className="italic text-[#9e9e9e]">Not noted at move-in</span>
          ) : (
            <span className="text-[#475467]">{card.moveInComment}</span>
          )}
        </div>
        <div>
          <span className="font-medium text-[#344054]">Move-out: </span>
          <span className="text-[#475467]">{card.moveOutComment}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Itemized list ────────────────────────────────────────────────────────────

function NewDamageList({ items }: { items: ListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[#667085]">No new damage items identified.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex flex-col gap-0.5 rounded-lg border border-[#eadfd5] bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-baseline sm:gap-2"
        >
          <span className="shrink-0 font-semibold text-[#101828]">
            {item.room}
          </span>
          <span className="text-[#667085]">—</span>
          <span className="flex-1 text-[#475467]">{item.comment}</span>
          {item.charge ? (
            <>
              <span className="text-[#667085]">—</span>
              <span className="shrink-0 font-semibold text-[#b74119]">
                {item.charge}
              </span>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ─── Clipboard text ───────────────────────────────────────────────────────────

function buildClipboardText(
  result: InspectionResult,
  displayAddress: string,
  tenant: TenantRecord | null,
): string {
  const lines: string[] = [];
  lines.push("MOVE-OUT INSPECTION REPORT");
  lines.push("=".repeat(40));
  lines.push(`Property:      ${displayAddress || result.property}`);
  if (tenant) {
    const fullName = [tenant.firstName, tenant.lastName]
      .filter(Boolean)
      .join(" ");
    if (fullName) lines.push(`Tenant:        ${fullName}`);
    if (tenant.moveIn) lines.push(`Move-In Date:  ${tenant.moveIn}`);
    if (tenant.moveOut) lines.push(`Move-Out Date: ${tenant.moveOut}`);
    if (tenant.deposit) lines.push(`Deposit:       $${tenant.deposit}`);
    if (tenant.tenantNotes) lines.push(`Tenant Notes:  ${tenant.tenantNotes}`);
  }
  lines.push(`Move-In:       ${result.moveInDate}`);
  lines.push(`Move-Out:      ${result.moveOutDate}`);
  lines.push("");

  lines.push("ROOM-BY-ROOM COMPARISON");
  lines.push("-".repeat(40));
  for (const card of result.cards) {
    lines.push(`${card.room} — ${card.issue}`);
    lines.push(
      `  Move-in:  ${card.moveInComment || "Not noted at move-in"}`,
    );
    lines.push(`  Move-out: ${card.moveOutComment}`);
    lines.push("");
  }

  lines.push("NEW DAMAGE SUMMARY");
  lines.push("-".repeat(40));
  if (result.newDamageList.length === 0) {
    lines.push("No new damage items identified.");
  } else {
    for (const item of result.newDamageList) {
      const charge = item.charge ? ` — ${item.charge}` : "";
      lines.push(`${item.room} — ${item.comment}${charge}`);
    }
  }

  return lines.join("\n");
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MoveOutInspectorPage() {
  const [address, setAddress] = useState("");
  const [moveInFile, setMoveInFile] = useState<File | null>(null);
  const [moveOutFile, setMoveOutFile] = useState<File | null>(null);
  const [tenantCsvFile, setTenantCsvFile] = useState<File | null>(null);
  const [tenantRecords, setTenantRecords] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // Load tenant CSV when file is selected
  useEffect(() => {
    if (!tenantCsvFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const records = parseTenantCsv(text);
      setTenantRecords(records);
      showToast(`Loaded ${records.length} tenant records`);
    };
    reader.readAsText(tenantCsvFile);
  }, [tenantCsvFile]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function runComparison() {
    if (!moveInFile || !moveOutFile) return;
    setLoading(true);
    setResult(null);
    setError("");
    const formData = new FormData();
    formData.append("moveIn", moveInFile);
    formData.append("moveOut", moveOutFile);
    try {
      const res = await fetch("/api/move-out-inspector/compare", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(
          (payload as { error?: string }).error ?? "Comparison failed.",
        );
      setResult(payload as InspectionResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unexpected error. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!result) return;
    const tenant =
      tenantRecords.length > 0
        ? lookupTenant(tenantRecords, address || result.property)
        : null;
    await navigator.clipboard.writeText(
      buildClipboardText(result, address || result.property, tenant),
    );
    showToast("Report copied to clipboard");
  }

  const displayAddress = address.trim() || result?.property || "";
  const matchedTenant =
    result && tenantRecords.length > 0
      ? lookupTenant(tenantRecords, displayAddress)
      : null;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: #1d2430 !important; }
          .print-container { padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      <main className="min-h-screen bg-[#f7f4ef] text-[#1d2430]">
        <div className="print-container mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="no-print border-b border-[#f05a28]/20 pb-5">
            <Link
              href="/"
              className="text-sm font-semibold text-[#b74119] transition hover:text-[#8c2d12]"
            >
              ← Back to TGPM Armory
            </Link>
            <div className="mt-5">
              <p className="text-sm font-semibold uppercase text-[#f05a28]">
                TGPM Armory
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[#101828] sm:text-4xl">
                Move-Out Inspector
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#52606d]">
                Upload move-in and move-out inspection PDFs to compare
                conditions room by room and identify new damage.
              </p>
            </div>
          </header>

          {/* Toasts */}
          {toast ? (
            <div className="no-print mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {toast}
            </div>
          ) : null}
          {error ? (
            <div className="no-print mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          ) : null}

          {/* Upload form */}
          <section className="no-print mt-6 rounded-lg border border-[#eadfd5] bg-white p-5 shadow-sm">
            {/* Tenant directory CSV */}
            <div className="mb-5 rounded-lg border border-[#eadfd5] bg-[#fbfaf8] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#344054]">
                    Tenant Directory CSV
                  </p>
                  <p className="mt-0.5 text-xs text-[#667085]">
                    Upload your daily tenant directory export to enable address
                    autocomplete and auto-populate tenant name, move-in date,
                    and deposit.
                  </p>
                </div>
                <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#eadfd5] bg-white px-3 text-sm font-semibold text-[#344054] shadow-sm transition hover:border-[#f05a28] hover:text-[#b74119]">
                  <CsvIcon className="h-4 w-4" />
                  {tenantCsvFile
                    ? tenantCsvFile.name
                    : "Upload tenant_directory.csv"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) =>
                      setTenantCsvFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>
              {tenantRecords.length > 0 ? (
                <p className="mt-2 text-xs text-emerald-700">
                  ✓ {tenantRecords.length} properties loaded — address
                  autocomplete active
                </p>
              ) : null}
            </div>

            {/* Address search */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-[#344054]">
                Property Address
              </label>
              <AddressSearch
                value={address}
                onChange={setAddress}
                tenantRecords={tenantRecords}
              />
              {/* Show tenant info inline if CSV loaded and address selected */}
              {tenantRecords.length > 0 && address.trim().length > 3
                ? (() => {
                    const t = lookupTenant(tenantRecords, address);
                    return t ? <TenantInfoBanner tenant={t} /> : null;
                  })()
                : null}
            </div>

            {/* PDF uploads */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Move-In Report
                </label>
                <PdfUploadZone
                  label="Move-In Inspection PDF"
                  file={moveInFile}
                  onFile={setMoveInFile}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#344054]">
                  Move-Out Report
                </label>
                <PdfUploadZone
                  label="Move-Out Inspection PDF"
                  file={moveOutFile}
                  onFile={setMoveOutFile}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void runComparison()}
                disabled={!moveInFile || !moveOutFile || loading}
                className="h-11 rounded-lg bg-[#f05a28] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d94d20] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Comparing…" : "Compare Reports"}
              </button>
              {loading ? (
                <p className="text-sm text-[#667085]">
                  Reading PDFs and comparing — usually 15–25 seconds…
                </p>
              ) : null}
            </div>
          </section>

          {/* Empty state */}
          {!result && !loading && !error ? (
            <section className="mt-6 grid flex-1 place-items-center rounded-lg border border-dashed border-[#d9cec2] bg-white/70 px-5 py-16 text-center">
              <div className="max-w-lg">
                <h2 className="text-xl font-semibold text-[#101828]">
                  Upload both inspection reports to get started
                </h2>
                <p className="mt-3 text-base leading-7 text-[#52606d]">
                  Every move-out comment gets a card showing what was noted at
                  move-in. New damage is summarized below. Upload the tenant
                  directory CSV to also see tenant name, move-in date, and
                  deposit.
                </p>
              </div>
            </section>
          ) : null}

          {/* Results */}
          {result ? (
            <div className="mt-6 flex-1 pb-8">
              {/* Property summary */}
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#eadfd5] bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#b74119]">
                    Move-Out Inspection Comparison
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#101828]">
                    {displayAddress}
                  </h2>
                  {matchedTenant ? (
                    <TenantInfoBanner tenant={matchedTenant} />
                  ) : result.tenantName ? (
                    <p className="mt-0.5 text-sm text-[#667085]">
                      Tenant: {result.tenantName}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-[#667085]">
                    Move-In: {result.moveInDate} &nbsp;·&nbsp; Move-Out:{" "}
                    {result.moveOutDate}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9e9e9e]">
                    {result.cards.length} move-out items ·{" "}
                    {result.newDamageList.length} new damage / charge items
                  </p>
                </div>
                <div className="no-print flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyToClipboard()}
                    className="h-10 rounded-lg border border-[#f05a28]/35 px-4 text-sm font-semibold text-[#b74119] shadow-sm transition hover:border-[#f05a28] hover:bg-[#fff4ed]"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-10 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#27364a]"
                  >
                    Export PDF
                  </button>
                </div>
              </div>

              {/* Room-by-room cards */}
              <section className="rounded-lg border border-[#eadfd5] bg-[#fbfaf8] p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-[#101828]">
                  Room-by-Room Comparison
                  <span className="ml-2 rounded-full bg-[#eadfd5] px-2.5 py-0.5 text-sm font-medium text-[#667085]">
                    {result.cards.length}
                  </span>
                </h2>
                {result.cards.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {result.cards.map((card, i) => (
                      <IssueCardView key={i} card={card} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#667085]">
                    No damage items found in the move-out report.
                  </p>
                )}
              </section>

              {/* New damage summary */}
              <section className="mt-5 rounded-lg border border-red-100 bg-red-50 p-5 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold text-red-900">
                  New Damage Summary
                  <span className="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-700">
                    {result.newDamageList.length}
                  </span>
                </h2>
                <p className="mb-4 text-sm text-red-700">
                  Items not noted at move-in, plus recommended charges — tenant
                  may be responsible
                </p>
                <NewDamageList items={result.newDamageList} />
              </section>
            </div>
          ) : null}

          <footer className="no-print border-t border-[#d9cec2]/60 py-5 text-center text-sm text-[#9e9e9e]">
            TGPM Internal Tools
          </footer>
        </div>
      </main>
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function ChevronIcon({ collapsed, className }: { collapsed: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${collapsed ? "" : "rotate-180"} ${className ?? ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CsvIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </svg>
  );
}
