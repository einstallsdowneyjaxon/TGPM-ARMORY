import { createHash } from "node:crypto";
import { analyzeLegalIntake } from "@/lib/legal-intake/analyze";
import { sendIntakeAlertEmail } from "@/lib/legal-intake/email";
import { extractDocumentText } from "@/lib/legal-intake/text-extract";
import type { LegalAnalysisResult } from "@/lib/legal-intake/types";
import { LEGAL_DISCLAIMER } from "@/lib/legal-intake/config";
import { getSupabaseClient } from "@/lib/supabase";

type UploadedFile = {
  file: File;
  role: "summons_complaint" | "supporting";
};

function storagePath(matterId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${matterId}/${Date.now()}-${safe}`;
}

function parseEventDate(eventAt: string): string | null {
  const parsed = new Date(eventAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function processLegalIntakeSubmission(params: {
  title?: string;
  propertyAddress?: string;
  publicDocketUrl?: string;
  uploads: UploadedFile[];
}) {
  if (params.uploads.length === 0) {
    throw new Error("Upload at least one summons/complaint document.");
  }

  const complaintUpload =
    params.uploads.find((item) => item.role === "summons_complaint") ??
    params.uploads[0];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const supabase = getSupabaseClient();
  const { data: matter, error: matterError } = await supabase
    .from("legal_matters")
    .insert({
      title: params.title?.trim() || "New legal intake",
      property_address: params.propertyAddress?.trim() || null,
      public_docket_url: params.publicDocketUrl?.trim() || null,
      analysis_disclaimer: LEGAL_DISCLAIMER,
    })
    .select("id, title")
    .single();

  if (matterError || !matter) {
    throw new Error(matterError?.message || "Failed to create legal matter.");
  }

  const extracted: Array<{
    fileName: string;
    role: "summons_complaint" | "supporting";
    text: string;
  }> = [];

  for (const upload of params.uploads) {
    const buffer = Buffer.from(await upload.file.arrayBuffer());
    const path = storagePath(matter.id, upload.file.name);
    const { error: storageError } = await supabase.storage
      .from("legal-intake-docs")
      .upload(path, buffer, {
        contentType: upload.file.type || "application/octet-stream",
        upsert: false,
      });

    if (storageError) {
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    const text = await extractDocumentText(
      buffer,
      upload.file.type || "application/octet-stream",
      upload.file.name,
      apiKey,
      model,
    );

    extracted.push({
      fileName: upload.file.name,
      role: upload.role,
      text,
    });

    const { error: docError } = await supabase.from("legal_documents").insert({
      matter_id: matter.id,
      doc_role: upload.role,
      file_name: upload.file.name,
      storage_path: path,
      mime_type: upload.file.type || null,
      byte_size: buffer.byteLength,
      ocr_text: text,
    });

    if (docError) {
      throw new Error(`Failed to save document metadata: ${docError.message}`);
    }
  }

  const complaintText =
    extracted.find((doc) => doc.fileName === complaintUpload.file.name)?.text ??
    extracted[0]?.text ??
    "";

  const supportingTexts = extracted
    .filter((doc) => doc.fileName !== complaintUpload.file.name)
    .map((doc) => ({ fileName: doc.fileName, text: doc.text }));

  const analysis = await analyzeLegalIntake({
    complaintText,
    supportingTexts,
    propertyAddressHint: params.propertyAddress,
    publicDocketUrl: params.publicDocketUrl,
    apiKey,
    model,
  });

  const courtDates = analysis.actionCourtDates
    .map((date) => ({
      label: date.label,
      event_at: parseEventDate(date.eventAt),
      timezone: date.timezone || "America/New_York",
    }))
    .filter((date) => date.event_at);

  if (courtDates.length > 0) {
    const { error: courtError } = await supabase.from("legal_court_dates").insert(
      courtDates.map((date) => ({
        matter_id: matter.id,
        label: date.label,
        event_at: date.event_at,
        timezone: date.timezone,
      })),
    );
    if (courtError) {
      throw new Error(`Failed to save court dates: ${courtError.message}`);
    }
  }

  if (analysis.initialDocketEntries.length > 0) {
    const { error: docketError } = await supabase.from("legal_docket_events").insert(
      analysis.initialDocketEntries.map((entry) => ({
        matter_id: matter.id,
        filed_at: entry.filedAt || null,
        title: entry.title,
        description: entry.description,
        source: "intake",
      })),
    );
    if (docketError) {
      throw new Error(`Failed to save docket entries: ${docketError.message}`);
    }
  }

  const matterTitle =
    params.title?.trim() || analysis.title?.trim() || "New legal intake";

  const { error: updateError } = await supabase
    .from("legal_matters")
    .update({
      title: matterTitle,
      case_number: analysis.caseNumber || null,
      court_name: analysis.courtName || null,
      county: analysis.county || null,
      plaintiff: analysis.plaintiff || null,
      defendant: analysis.defendant || null,
      property_address:
        analysis.propertyAddress || params.propertyAddress?.trim() || null,
      intake_summary: analysis.intakeSummary,
      action_court_dates: analysis.actionCourtDates,
      florida_research: analysis.floridaResearch,
      proposed_next_steps: analysis.proposedNextSteps,
      updated_at: new Date().toISOString(),
    })
    .eq("id", matter.id);

  if (updateError) {
    throw new Error(`Failed to update matter analysis: ${updateError.message}`);
  }

  await sendIntakeAlertEmail({
    matterId: matter.id,
    title: matterTitle,
    summary: analysis.intakeSummary,
    courtDates: analysis.actionCourtDates.map((date) => ({
      label: date.label,
      eventAt: date.eventAt,
    })),
    nextSteps: analysis.proposedNextSteps,
  });

  return {
    matterId: matter.id,
    title: matterTitle,
    analysis,
    documentCount: extracted.length,
    fingerprint: createHash("sha256").update(complaintText).digest("hex"),
  };
}
