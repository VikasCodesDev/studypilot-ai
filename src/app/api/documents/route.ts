import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import {
  listPdfDocuments,
  processAndSavePdf,
  toClientDocument,
} from "@/lib/mongo-documents";

export const runtime = "nodejs";
export const maxDuration = 60;

// Stable direct-upload ceiling. Vercel Serverless Functions cap request
// bodies at ~4.5MB, so this route intentionally targets small PDFs
// (<=5MB) rather than the larger blob-based flow, per current
// requirements: a reliable small-file upload beats an unreliable large
// one. Files that don't fit are rejected with a clear error before any
// processing is attempted.
const MAX_PDF_BYTES = 5 * 1024 * 1024;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({ documents: await listPdfDocuments(user.id) });
  } catch (err) {
    console.error("[api/documents][GET] failed", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch documents",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let filename = "";

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A PDF file is required" },
        { status: 400 },
      );
    }
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 },
      );
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          error: `PDF exceeds the ${MAX_PDF_BYTES / (1024 * 1024)}MB size limit`,
        },
        { status: 413 },
      );
    }

    filename = file.name;
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/pdf";

    if (bytes.length === 0) {
      return NextResponse.json(
        { error: "Uploaded PDF is empty" },
        { status: 400 },
      );
    }

    const { doc, analyzed } = await processAndSavePdf({
      userId: user.id,
      filename,
      mimeType,
      bytes,
    });

    await db.insert(aiActivityLog).values({
      userId: user.id,
      agentName: "PDF Intelligence",
      action: `Analyzed PDF: ${filename}`,
      status: "success",
      provider: analyzed.provider,
      details: `Extracted ${doc.wordCount} words using ${doc.extractionMethod}`,
    });

    return NextResponse.json({ document: toClientDocument(doc) });
  } catch (err) {
    console.error("[api/documents][POST] PDF upload/analysis failed", {
      userId: user.id,
      filename,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    await db
      .insert(aiActivityLog)
      .values({
        userId: user.id,
        agentName: "PDF Intelligence",
        action: "PDF analysis failed",
        status: "failed",
        details: err instanceof Error ? err.message : "Failed to process PDF",
      })
      .catch(() => undefined);

    const message = err instanceof Error ? err.message : "Failed to process PDF";
    const status = /empty|only pdf|required|invalid|exceeds/i.test(message)
      ? 400
      : /extract text|too large|scanned/i.test(message)
        ? 422
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
