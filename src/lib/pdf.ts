import { PDFParse } from "pdf-parse";
import { extractPdfTextWithGemini } from "@/lib/ai-provider";
import { pathToFileURL } from "node:url";
import path from "node:path";

const MIN_TEXT_CHARS = 80;
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

export async function extractPdfText(buffer: Buffer, filename: string) {
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

  const ocrText = await extractPdfTextWithGemini(buffer, filename);

  return {
    text: normalizeText(ocrText),
    pageCount: parsed.total || null,
    extractionMethod: "gemini-ocr",
  };
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
