import { extractText } from "unpdf";

function summarizeError(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 400);
}

export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const lowerName = fileName.toLowerCase();
  const isPdf =
    mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|heic)$/i.test(lowerName);

  if (isPdf) {
    const result = await extractText(new Uint8Array(buffer));
    const text = result.text.join("\n").trim();
    if (text.length >= 80) return text;
  }

  if (isImage) {
    const base64 = buffer.toString("base64");
    const mediaType = mimeType || "image/jpeg";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Extract all readable text from this legal document image. Preserve dates, party names, case numbers, and deadlines. Return plain text only.",
              },
              {
                type: "input_image",
                image_url: `data:${mediaType};base64,${base64}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenAI OCR failed (${response.status}): ${summarizeError(errText)}`,
      );
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const fromOutputText = payload.output_text?.trim();
    if (fromOutputText) return fromOutputText;

    const chunks =
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .map((part) => part.text ?? "")
        .join("\n")
        .trim() ?? "";

    if (chunks) return chunks;
  }

  const plain = buffer.toString("utf8").trim();
  if (plain.length >= 40) return plain;

  throw new Error(
    `Could not extract text from ${fileName}. Supported: PDF and image files.`,
  );
}
