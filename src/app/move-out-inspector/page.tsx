"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { InspectionComparison, MatchedItem } from "@/lib/inspection-parser";

// ─── Address autocomplete ────────────────────────────────────────────────────

function AddressSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
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
  }, []);

  function handleChange(v: string) {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(v), 300);
  }

  function select(address: string) {
    onChange(address);
    setSuggestions([]);
    setOpen(false);
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
        placeholder="Search property address (optional)"
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

// ─── File upload zone ─────────────────────────────────────────────────────────

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

// ─── Result sections ──────────────────────────────────────────────────────────

type SectionTone = "danger" | "warning" | "neutral";

const toneStyles: Record<
  SectionTone,
  { border: string; bg: string; badge: string; badgeText: string; heading: string }
> = {
  danger: {
    border: "border-red-200",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-700",
    badgeText: "text-red-700",
    heading: "text-red-900",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "text-amber-700",
    heading: "text-amber-900",
  },
  neutral: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    badgeText: "text-emerald-700",
    heading: "text-emerald-900",
  },
};

function conditionLabel(condition: string) {
  return condition === "D" ? "Damaged" : condition === "F" ? "Fair" : "Satisfactory";
}

function ItemCard({
  item,
  tone,
}: {
  item: MatchedItem;
  tone: SectionTone;
}) {
  const s = toneStyles[tone];
  return (
    <div className="rounded-lg border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
            {item.area}
          </p>
          <p className="mt-0.5 text-base font-semibold text-[#101828]">
            {item.detail}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {item.moveIn ? (
          <div>
            <span className="font-medium text-[#344054]">Move-in: </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                item.moveIn.condition === "S"
                  ? "bg-emerald-100 text-emerald-700"
                  : item.moveIn.condition === "F"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {conditionLabel(item.moveIn.condition)}
            </span>
            {item.moveIn.comment ? (
              <span className="ml-1 text-[#475467]">{item.moveIn.comment}</span>
            ) : null}
          </div>
        ) : (
          <p className="italic text-[#9e9e9e]">Not noted at move-in</p>
        )}

        {item.moveOut ? (
          <div>
            <span className="font-medium text-[#344054]">Move-out: </span>
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${s.badge}`}>
              {conditionLabel(item.moveOut.condition)}
            </span>
            {item.moveOut.comment ? (
              <span className="ml-1 text-[#475467]">{item.moveOut.comment}</span>
            ) : null}
          </div>
        ) : (
          <p className="italic text-[#9e9e9e]">Not re-noted at move-out</p>
        )}
      </div>
    </div>
  );
}

function ResultSection({
  title,
  description,
  items,
  tone,
  defaultCollapsed = false,
}: {
  title: string;
  description: string;
  items: MatchedItem[];
  tone: SectionTone;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const s = toneStyles[tone];

  return (
    <section className={`rounded-lg border ${s.border} ${s.bg} p-5`}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-lg font-semibold ${s.heading}`}>{title}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.badge}`}>
              {items.length}
            </span>
          </div>
          <p className={`mt-1 text-sm ${s.badgeText} opacity-80`}>{description}</p>
        </div>
        <ChevronIcon collapsed={collapsed} />
      </button>

      {!collapsed && items.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, i) => (
            <ItemCard key={`${item.area}-${item.detail}-${i}`} item={item} tone={tone} />
          ))}
        </div>
      )}

      {!collapsed && items.length === 0 && (
        <p className={`mt-3 text-sm ${s.badgeText} opacity-70`}>None found.</p>
      )}
    </section>
  );
}

// ─── Clipboard / print helpers ────────────────────────────────────────────────

function buildClipboardText(result: InspectionComparison): string {
  const lines: string[] = [];

  lines.push("MOVE-OUT INSPECTION COMPARISON");
  lines.push("=".repeat(40));
  lines.push(`Property:      ${result.property}`);
  if (result.tenantName) lines.push(`Tenant:        ${result.tenantName}`);
  lines.push(`Move-In Date:  ${result.moveInDate}`);
  lines.push(`Move-Out Date: ${result.moveOutDate}`);
  lines.push("");

  function appendSection(
    heading: string,
    items: MatchedItem[],
    showMoveIn: boolean,
  ) {
    lines.push(heading);
    lines.push("-".repeat(40));
    if (items.length === 0) {
      lines.push("  None");
    } else {
      for (const item of items) {
        lines.push(`• ${item.area} / ${item.detail}`);
        if (showMoveIn && item.moveIn) {
          lines.push(
            `  Move-in:  ${conditionLabel(item.moveIn.condition)}${item.moveIn.comment ? ` — ${item.moveIn.comment}` : ""}`,
          );
        } else if (showMoveIn) {
          lines.push("  Move-in:  Not noted");
        }
        if (item.moveOut) {
          lines.push(
            `  Move-out: ${conditionLabel(item.moveOut.condition)}${item.moveOut.comment ? ` — ${item.moveOut.comment}` : ""}`,
          );
        }
      }
    }
    lines.push("");
  }

  appendSection(
    "NEW DAMAGE — Tenant May Be Responsible",
    result.newDamage,
    true,
  );
  appendSection("PRE-EXISTING CONDITIONS", result.preExisting, true);
  appendSection("RESOLVED / Not Re-Noted at Move-Out", result.resolved, true);

  return lines.join("\n");
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MoveOutInspectorPage() {
  const [address, setAddress] = useState("");
  const [moveInFile, setMoveInFile] = useState<File | null>(null);
  const [moveOutFile, setMoveOutFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectionComparison | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
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
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error ?? "Comparison failed.",
        );
      }
      setResult(payload as InspectionComparison);
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
    const text = buildClipboardText(result);
    await navigator.clipboard.writeText(text);
    showToast("Report copied to clipboard");
  }

  function exportPdf() {
    window.print();
  }

  const canCompare = moveInFile && moveOutFile && !loading;
  const displayAddress = address.trim() || result?.property || "";

  return (
    <>
      {/* Print styles — hidden controls, clean report layout */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: #1d2430 !important; }
          .print-container { padding: 0 !important; max-width: 100% !important; }
          .result-section { break-inside: avoid; }
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
                Upload move-in and move-out inspection PDFs to instantly see new
                damage, pre-existing conditions, and resolved items.
              </p>
            </div>
          </header>

          {/* Toast */}
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
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-[#344054]">
                Property Address
              </label>
              <AddressSearch value={address} onChange={setAddress} />
            </div>

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
                disabled={!canCompare}
                className="h-11 rounded-lg bg-[#f05a28] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d94d20] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Comparing…" : "Compare Reports"}
              </button>
              {loading ? (
                <p className="text-sm text-[#667085]">
                  Reading PDFs and comparing with AI — usually 10–20 seconds…
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
                  The tool reads the PDF text, extracts every inspection item,
                  and groups them into new damage, pre-existing conditions, and
                  resolved items.
                </p>
              </div>
            </section>
          ) : null}

          {/* Results */}
          {result ? (
            <div className="mt-6 flex-1 pb-8">
              {/* Property summary + action buttons */}
              <div className="mb-5 flex flex-col gap-3 rounded-lg border border-[#eadfd5] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#b74119]">
                    Inspection Comparison
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[#101828]">
                    {displayAddress || result.property}
                  </h2>
                  {result.tenantName ? (
                    <p className="mt-0.5 text-sm text-[#667085]">
                      Tenant: {result.tenantName}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-sm text-[#667085]">
                    Move-In: {result.moveInDate} &nbsp;·&nbsp; Move-Out:{" "}
                    {result.moveOutDate}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9e9e9e]">
                    {result.itemCount.moveIn} items from move-in ·{" "}
                    {result.itemCount.moveOut} items from move-out
                  </p>
                </div>
                <div className="no-print flex gap-2">
                  <button
                    type="button"
                    onClick={() => void copyToClipboard()}
                    className="h-10 rounded-lg border border-[#f05a28]/35 px-4 text-sm font-semibold text-[#b74119] shadow-sm transition hover:border-[#f05a28] hover:bg-[#fff4ed]"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    type="button"
                    onClick={exportPdf}
                    className="h-10 rounded-lg bg-[#101828] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#27364a]"
                  >
                    Export PDF
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="result-section">
                  <ResultSection
                    title="New Damage"
                    description="Noted at move-out but absent or satisfactory at move-in — tenant may be responsible"
                    items={result.newDamage}
                    tone="danger"
                  />
                </div>
                <div className="result-section">
                  <ResultSection
                    title="Pre-Existing Conditions"
                    description="Noted as damaged or fair on both reports — tenant is not responsible"
                    items={result.preExisting}
                    tone="warning"
                  />
                </div>
                <div className="result-section">
                  <ResultSection
                    title="Resolved / Not Re-Noted"
                    description="Noted at move-in but not flagged at move-out"
                    items={result.resolved}
                    tone="neutral"
                    defaultCollapsed
                  />
                </div>
              </div>
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

// ─── Small SVG icons ──────────────────────────────────────────────────────────

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
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-5 w-5 shrink-0 transition-transform ${collapsed ? "" : "rotate-180"}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

