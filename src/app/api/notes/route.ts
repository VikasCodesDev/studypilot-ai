import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import { callAI } from "@/lib/ai-provider";
import { getMongoDb } from "@/lib/mongodb";
import { getPdfDocument } from "@/lib/mongo-documents";

const NOTE_PROMPTS: Record<string, string> = {
  detailed: "Generate comprehensive, detailed study notes with explanations, examples, and key definitions. Use clear headings and structured markdown.",
  revision: "Generate concise revision notes highlighting the most important points for quick review before exams.",
  summary: "Generate a complete but concise chapter/topic summary.",
  cheatsheet: "Generate a compact cheat sheet with critical formulas, definitions, rules, and quick-reference information.",
  flashcards: "Generate at least 10 flashcard-style Q&A pairs using **Q:** and **A:** formatting.",
  keypoints: "Extract numbered key points and takeaways with brief explanations.",
  formulas: "Extract formulas, equations, theorems, and mathematical relationships with usage notes.",
};

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mongo = await getMongoDb();
    const documentId = req.nextUrl.searchParams.get("documentId");
    const filter: Record<string, unknown> = { userId: user.id };
    if (documentId) filter.documentId = documentId;

    const notes = await mongo.collection("ai_notes").find(filter).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({
      notes: notes.map((note) => ({ ...note, id: note._id.toString(), _id: undefined })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch notes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentId, type, topic } = await req.json();
    if (!documentId || !type) {
      return NextResponse.json({ error: "documentId and type are required" }, { status: 400 });
    }
    if (!NOTE_PROMPTS[type]) {
      return NextResponse.json({ error: "Invalid note type" }, { status: 400 });
    }

    const doc = await getPdfDocument(user.id, documentId);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const topicInstruction = topic ? `Focus specifically on "${topic}".` : "Cover the entire extracted PDF.";
    const result = await callAI({
      systemPrompt: "You are an expert educational content creator. Use only the provided extracted PDF content. Return markdown.",
      prompt: `${NOTE_PROMPTS[type]}

${topicInstruction}

PDF: "${doc.filename}"
Subject: ${doc.analysis.subject}
Difficulty: ${doc.analysis.difficulty}
Chapters: ${doc.analysis.chapters.join(", ")}
Concepts: ${doc.analysis.concepts.join(", ")}

Extracted PDF content:
${doc.extractedText.substring(0, 12000)}`,
      temperature: 0.5,
      maxTokens: 4096,
    });

    const mongo = await getMongoDb();
    const now = new Date();
    const insert = await mongo.collection("ai_notes").insertOne({
      userId: user.id,
      documentId,
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Notes - ${topic || doc.filename}`,
      content: result.content,
      topic: topic || null,
      provider: result.provider,
      model: result.model,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(aiActivityLog).values({
      userId: user.id,
      agentName: "Smart Notes",
      action: `Generated ${type} notes for: ${doc.filename}`,
      status: "success",
      provider: result.provider,
    });

    const note = await mongo.collection("ai_notes").findOne({ _id: insert.insertedId });
    return NextResponse.json({ note: { ...note, id: insert.insertedId.toString(), _id: undefined } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate notes" },
      { status: 500 },
    );
  }
}
