import { NextResponse } from "next/server";
import { extractText } from "unpdf";
import { compareInspections } from "@/lib/inspection-parser";

export const runtime = "nodejs";

async function pdfToText(buffer: Buffer): Promise<string> {
  const result = await extractText(new Uint8Array(buffer));
  return result.text.join("\n");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing OPENAI_API_KEY. Add it to .env.local and restart the dev server.",
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const moveInFile = formData.get("moveIn");
    const moveOutFile = formData.get("moveOut");

    if (!(moveInFile instanceof File) || !(moveOutFile instanceof File)) {
      return NextResponse.json(
        { error: "Both a move-in PDF and a move-out PDF are required." },
        { status: 400 },
      );
    }

    if (
      !moveInFile.name.toLowerCase().endsWith(".pdf") ||
      !moveOutFile.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Both uploaded files must be PDFs." },
        { status: 400 },
      );
    }

    const [moveInBuffer, moveOutBuffer] = await Promise.all([
      moveInFile.arrayBuffer().then((ab) => Buffer.from(ab)),
      moveOutFile.arrayBuffer().then((ab) => Buffer.from(ab)),
    ]);

    const [moveInText, moveOutText] = await Promise.all([
      pdfToText(moveInBuffer),
      pdfToText(moveOutBuffer),
    ]);

    const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const comparison = await compareInspections(
      moveInText,
      moveOutText,
      apiKey,
      model,
    );

    return NextResponse.json(comparison);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error during inspection comparison.",
      },
      { status: 500 },
    );
  }
}
