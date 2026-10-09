"use client";

import Link from "next/link";
import { useRef, useState } from "react";

function FilePicker({
  label,
  hint,
  multiple,
  files,
  onFiles,
}: {
  label: string;
  hint: string;
  multiple?: boolean;
  files: File[];
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border border-white/10 bg-[#101d31] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10"
        >
          Choose files
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept=".pdf,image/*"
        onChange={(event) => {
          const next = event.target.files ? Array.from(event.target.files) : [];
          onFiles(next);
        }}
      />
      {files.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`}>{file.name}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function LegalIntakePage() {
  const [title, setTitle] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [publicDocketUrl, setPublicDocketUrl] = useState("");
  const [complaintFiles, setComplaintFiles] = useState<File[]>([]);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultId, setResultId] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResultId("");

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("propertyAddress", propertyAddress);
      formData.set("publicDocketUrl", publicDocketUrl);
      for (const file of complaintFiles) {
        formData.append("complaintFiles", file);
      }
      for (const file of supportingFiles) {
        formData.append("supportingFiles", file);
      }

      const response = await fetch("/api/legal-intake/submit", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        matterId?: string;
        error?: string;
      };

      if (!response.ok || !payload.matterId) {
        throw new Error(payload.error || "Submission failed.");
      }

      setResultId(payload.matterId);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit legal intake.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Back to Armory
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Legal Summons & Complaint Intake
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Upload court documents and supporting evidence. OCR + AI will extract
          deadlines, build a mini docket, email your alert list, and suggest
          operational next steps with Florida research context. This is not legal
          advice.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Matter title (optional)
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Smith v. TGPM — 6536 Anvers Blvd S"
              className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-4 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Property address
            </span>
            <input
              value={propertyAddress}
              onChange={(event) => setPropertyAddress(event.target.value)}
              placeholder="Property tied to the lawsuit"
              className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-4 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Public docket URL (optional)
            </span>
            <input
              value={publicDocketUrl}
              onChange={(event) => setPublicDocketUrl(event.target.value)}
              placeholder="Clerk portal docket link for automatic filing checks"
              className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#0e1a2c] px-4 text-white outline-none focus:border-cyan-300"
            />
          </label>

          <FilePicker
            label="Summons / complaint documents"
            hint="Required. PDF or image scans."
            multiple
            files={complaintFiles}
            onFiles={setComplaintFiles}
          />

          <FilePicker
            label="Supporting files"
            hint="Work orders, photos, inspections, emails, etc."
            multiple
            files={supportingFiles}
            onFiles={setSupportingFiles}
          />

          <button
            type="submit"
            disabled={loading || complaintFiles.length === 0}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-cyan-300 px-5 text-sm font-semibold text-[#07111f] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processing documents..." : "Submit intake"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {resultId ? (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Intake complete. Alerts were sent to your configured legal email
            list.{" "}
            <Link
              href={`/legal-intake/${resultId}`}
              className="font-semibold underline"
            >
              Open mini docket
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
