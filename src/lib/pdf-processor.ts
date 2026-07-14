import { extractPdfTextWithGemini } from "@/lib/ai-provider";
import { PDFParse } from "pdf-parse";

const MIN_TEXT_CHARS = 80;

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

let pdfParseWorkerConfigured = false;
function configurePdfParseWorker() {
  if (pdfParseWorkerConfigured) return;
  pdfParseWorkerConfigured = true;

  // pdf-parse uses pdfjs under the hood. In some environments (notably
  // serverless) pdfjs may reference browser globals like DOMMatrix.
  // We attempt to run it, but fall back to pdf-lib/Gemini if it crashes.
  try {
    // Avoid top-level DOM usage; only compute a worker URL.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("node:path");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { pathToFileURL } = require("node:url");

    const workerPath = pathToFileURL(
      path.join(
        process.cwd(),
        "node_modules",
        "pdf-parse",
        "dist",
        "pdf-parse",
        "esm",
        "pdf.worker.mjs",
      ),
    ).href;

    PDFParse.setWorker(workerPath);
  } catch {
    // If worker config fails, we'll still try parsing; pdf-parse may have
    // another internal fallback.
  }
}

export async function extractPdfText(buffer: Buffer, filename: string) {
  // 1) Try pdf-parse (fastest)
  try {
    configurePdfParseWorker();
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = normalizeText(parsed.text);

    if (text.length >= MIN_TEXT_CHARS) {
      return {
        text,
        pageCount: parsed.total || null,
        extractionMethod: "pdf-text",
      };
    }
  } catch (err) {
    // Swallow and fall back without changing API behavior.
    // Intentionally no throw here; serverless may crash due to DOMMatrix.
    // eslint-disable-next-line no-console
    console.warn("[pdf] pdf-parse failed, falling back", {
      filename,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2) Gemini OCR fallback (existing business logic)
  // pdf-parse can crash on Vercel serverless with browser-only globals
  // (e.g., DOMMatrix). Gemini OCR is always Node-compatible.
  const ocrText = await extractPdfTextWithGemini(buffer, filename);
  return {
    text: normalizeText(ocrText),
    pageCount: null,
    extractionMethod: "gemini-ocr",
  };
}
