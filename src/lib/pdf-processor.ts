import { extractPdfTextWithGemini } from "@/lib/ai-provider";
import { extractText, getDocumentProxy } from "unpdf";

const MIN_TEXT_CHARS = 80;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function extractPdfText(buffer: Buffer, filename: string) {
  // 1) Try unpdf (pure JS, pdfjs-based, no native/DOM deps).
  // Works identically on Node (local) and serverless (Vercel) runtimes.
  try {
    const data = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(data);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const normalized = normalizeText(
      Array.isArray(text) ? text.join(" ") : text,
    );

    if (normalized.length >= MIN_TEXT_CHARS) {
      return {
        text: normalized,
        pageCount: totalPages || null,
        extractionMethod: "pdf-text",
      };
    }
  } catch (err) {
    // Swallow and fall back without changing API behavior.
    console.warn("[pdf] unpdf extraction failed, falling back", {
      filename,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2) Gemini OCR fallback (existing business logic) for scanned PDFs
  // or PDFs unpdf could not parse.
  const ocrText = await extractPdfTextWithGemini(buffer, filename);
  return {
    text: normalizeText(ocrText),
    pageCount: null,
    extractionMethod: "gemini-ocr",
  };
}
