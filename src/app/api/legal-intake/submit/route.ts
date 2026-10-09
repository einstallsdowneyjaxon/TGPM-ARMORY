import { NextResponse } from "next/server";
import { processLegalIntakeSubmission } from "@/lib/legal-intake/process-matter";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "");
    const propertyAddress = String(formData.get("propertyAddress") ?? "");
    const publicDocketUrl = String(formData.get("publicDocketUrl") ?? "");

    const complaintFiles = formData
      .getAll("complaintFiles")
      .filter((entry): entry is File => entry instanceof File);
    const supportingFiles = formData
      .getAll("supportingFiles")
      .filter((entry): entry is File => entry instanceof File);

    const uploads = [
      ...complaintFiles.map((file) => ({
        file,
        role: "summons_complaint" as const,
      })),
      ...supportingFiles.map((file) => ({
        file,
        role: "supporting" as const,
      })),
    ];

    const result = await processLegalIntakeSubmission({
      title,
      propertyAddress,
      publicDocketUrl,
      uploads,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error during legal intake processing.",
      },
      { status: 500 },
    );
  }
}
