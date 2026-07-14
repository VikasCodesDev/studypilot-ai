import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { getPdfFile } from "@/lib/mongo-documents";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const result = await getPdfFile(user.id, id);
    if (!result) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    return new NextResponse(Readable.toWeb(result.stream) as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.doc.filename.replaceAll('"', "")}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load PDF" },
      { status: 500 },
    );
  }
}
