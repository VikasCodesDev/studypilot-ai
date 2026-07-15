import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import {
  listPdfDocuments,
  processAndSavePdf,
  toClientDocument,
} from "@/lib/mongo-documents";

// PDF extraction (unpdf) and Gemini analysis of large documents can take
// well beyond the platform default. Give this route room to run instead
// of racing against a short default timeout ("no timeout" requirement).
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PDF_BYTES = 100 * 1024 * 1024; // 100MB ceiling, matches blob-upload route

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

  const contentType = req.headers.get("content-type") || "";
  let filename = "";
  let blobUrlToCleanUp: string | null = null;

  try {
    let bytes: Buffer;
    let mimeType: string;

    if (contentType.includes("application/json")) {
      // ── Large-file path ──────────────────────────────────────────
      // Browser already uploaded the PDF straight to Vercel Blob (see
      // /api/documents/blob-upload). We only receive a small JSON
      // payload with the resulting URL, so there is no request-body
      // size limit to worry about here.
      const body = await req.json();
      const blobUrl: unknown = body?.blobUrl;
      filename = typeof body?.filename === "string" ? body.filename : "";

      if (typeof blobUrl !== "string" || !blobUrl) {
        return NextResponse.json(
          { error: "blobUrl is required" },
          { status: 400 },
        );
      }
      if (!filename) {
        return NextResponse.json(
          { error: "filename is required" },
          { status: 400 },
        );
      }
      if (
        !/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(
          blobUrl,
        )
      ) {
        return NextResponse.json(
          { error: "Invalid blob URL" },
          { status: 400 },
        );
      }
      if (
        !filename.toLowerCase().endsWith(".pdf") &&
        typeof body?.mimeType === "string" &&
        body.mimeType !== "application/pdf"
      ) {
        return NextResponse.json(
          { error: "Only PDF files are supported" },
          { status: 400 },
        );
      }

      blobUrlToCleanUp = blobUrl;

      const downloadRes = await fetch(blobUrl);
      if (!downloadRes.ok) {
        throw new Error(
          `Failed to download uploaded PDF from storage (${downloadRes.status})`,
        );
      }
      const contentLength = Number(
        downloadRes.headers.get("content-length") || 0,
      );
      if (contentLength && contentLength > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "PDF exceeds the 100MB size limit" },
          { status: 413 },
        );
      }

      const arrayBuffer = await downloadRes.arrayBuffer();
      bytes = Buffer.from(arrayBuffer);
      mimeType =
        typeof body?.mimeType === "string" && body.mimeType
          ? body.mimeType
          : downloadRes.headers.get("content-type") || "application/pdf";
    } else {
      // ── Small-file path (backward compatible) ────────────────────
      // Direct multipart body upload. Still works for small PDFs, but
      // is subject to the platform's request body size limit, which
      // is exactly why large files use the blob path above.
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

      filename = file.name;
      bytes = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || "application/pdf";
    }

    if (bytes.length > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: "PDF exceeds the 100MB size limit" },
        { status: 413 },
      );
    }
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

    // Blob storage was only a transient handoff for large uploads; the
    // PDF now lives permanently in MongoDB GridFS, so drop the temp blob.
    if (blobUrlToCleanUp) {
      await del(blobUrlToCleanUp).catch((err) => {
        console.warn("[api/documents][POST] failed to delete temp blob", {
          blobUrl: blobUrlToCleanUp,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

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

    if (blobUrlToCleanUp) {
      await del(blobUrlToCleanUp).catch(() => undefined);
    }

    const message = err instanceof Error ? err.message : "Failed to process PDF";
    const status = /empty|only pdf|required|invalid|exceeds/i.test(message)
      ? 400
      : /extract text|too large|scanned/i.test(message)
        ? 422
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
