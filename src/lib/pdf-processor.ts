import { extractPdfTextWithGemini } from "@/lib/ai-provider";
import { extractText, getDocumentProxy } from "unpdf";

const MIN_TEXT_CHARS = 80;

// Gemini's inline `inline_data` payload (used for OCR fallback on scanned
// PDFs) is base64-encoded, which inflates the raw file size by ~33%, and
// Google's inline request size ceiling is ~20MB. Files above this raw size
// cannot go through the inline OCR fallback and would otherwise fail with
// an opaque "Gemini API error" deep in the pipeline. We only reach this
// guard for PDFs that unpdf's text layer extraction failed to read from
// (e.g. scanned/image-only PDFs), so normal large text-based PDFs are
// unaffected and go through unpdf regardless of file size.
const MAX_GEMINI_INLINE_OCR_BYTES = 15 * 1024 * 1024;

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
  if (buffer.length > MAX_GEMINI_INLINE_OCR_BYTES) {
    throw new Error(
      `This PDF appears to be scanned/image-based and is too large (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) for OCR fallback. OCR fallback supports files up to ${MAX_GEMINI_INLINE_OCR_BYTES / (1024 * 1024)}MB. Try a text-based PDF or split it into smaller files.`,
    );
  }
  const ocrText = await extractPdfTextWithGemini(buffer, filename);
  return {
    text: normalizeText(ocrText),
    pageCount: null,
    extractionMethod: "gemini-ocr",
  };
}
