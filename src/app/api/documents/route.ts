import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import { extractPdfText } from "@/lib/pdf";
import {
  analyzeExtractedText,
  listPdfDocuments,
  savePdfDocument,
  toClientDocument,
} from "@/lib/mongo-documents";

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

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json(
        { error: "Uploaded PDF is empty" },
        { status: 400 },
      );
    }

    const extracted = await extractPdfText(bytes, file.name);
    if (!extracted.text) {
      return NextResponse.json(
        { error: "Unable to extract text from this PDF" },
        { status: 422 },
      );
    }

    const analyzed = await analyzeExtractedText(extracted.text, file.name);
    const doc = await savePdfDocument({
      userId: user.id,
      filename: file.name,
      mimeType: file.type || "application/pdf",
      bytes,
      extractedText: extracted.text,
      extractionMethod: extracted.extractionMethod,
      pageCount: extracted.pageCount,
      analysis: analyzed.analysis,
      aiProvider: analyzed.provider,
      aiModel: analyzed.model,
    });

    await db.insert(aiActivityLog).values({
      userId: user.id,
      agentName: "PDF Intelligence",
      action: `Analyzed PDF: ${file.name}`,
      status: "success",
      provider: analyzed.provider,
      details: `Extracted ${doc.wordCount} words using ${doc.extractionMethod}`,
    });

    return NextResponse.json({ document: toClientDocument(doc) });
  } catch (err) {
    console.error("[api/documents][POST] PDF upload/analysis failed", {
      userId: user.id,
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

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process PDF" },
      { status: 500 },
    );
  }
}
