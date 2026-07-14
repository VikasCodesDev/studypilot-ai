import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  deletePdfDocument,
  getPdfDocument,
  reanalyzePdfDocument,
  toClientDocument,
} from "@/lib/mongo-documents";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const doc = await getPdfDocument(user.id, id);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    return NextResponse.json({ document: toClientDocument(doc) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch document" },
      { status: 500 },
    );
  }
}

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const doc = await reanalyzePdfDocument(user.id, id);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    return NextResponse.json({ document: toClientDocument(doc) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to re-analyze document" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const deleted = await deletePdfDocument(user.id, id);
    if (!deleted) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete document" },
      { status: 500 },
    );
  }
}
