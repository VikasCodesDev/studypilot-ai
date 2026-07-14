import { extractPdfTextWithGemini } from "@/lib/ai-provider";
import { PDFDocument } from "pdf-lib";

const MIN_TEXT_CHARS = 80;

export async function extractPdfTextWithPdfLib(
  buffer: Buffer,
  filename: string,
) {
  // pdf-lib can extract text only from PDFs that actually contain text layers.
  // For scanned PDFs we fall back to Gemini OCR.
  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();

  let out = "";
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    // pdf-lib does not currently expose text extraction reliably in all cases,
    // but it can return text for some PDFs via getTextContent.
    // Use best-effort: if no text, keep going.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textContent: any = await (page as any).getTextContent?.();
    const pageText =
      textContent?.items
        ?.map((it: any) => it.str)
        .filter(Boolean)
        .join(" ") || "";

    if (pageText) out += (out ? "\n" : "") + pageText;
  }

  const text = normalizeText(out);

  if (text.length >= MIN_TEXT_CHARS) {
    return {
      text,
      pageCount: pages.length || null,
      extractionMethod: "pdf-text",
    };
  }

  const ocrText = await extractPdfTextWithGemini(buffer, filename);
  return {
    text: normalizeText(ocrText),
    pageCount: pages.length || null,
    extractionMethod: "gemini-ocr",
  };
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
