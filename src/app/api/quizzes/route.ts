import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import { callAI, parseAIJson } from "@/lib/ai-provider";
import { getMongoDb } from "@/lib/mongodb";
import { getPdfDocument } from "@/lib/mongo-documents";
import type { QuizQuestion } from "@/db/schema";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const documentId = req.nextUrl.searchParams.get("documentId");
    const filter: Record<string, unknown> = { userId: user.id };
    if (documentId) filter.documentId = documentId;

    const mongo = await getMongoDb();
    const quizzes = await mongo.collection("ai_quizzes").find(filter).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({
      quizzes: quizzes.map((quiz) => ({ ...quiz, id: quiz._id.toString(), _id: undefined })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch quizzes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentId, difficulty, questionType, count } = await req.json();
    if (!documentId || !difficulty || !questionType) {
      return NextResponse.json({ error: "documentId, difficulty, and questionType are required" }, { status: 400 });
    }

    const doc = await getPdfDocument(user.id, documentId);
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const numQuestions = Math.min(count || 5, 15);
    const typeInstruction =
      questionType === "mcq"
        ? "Generate multiple choice questions. Each question must have exactly 4 options. correctAnswer must be the full text of the correct option."
        : questionType === "subjective"
          ? "Generate short-answer questions. No options field needed. correctAnswer should be the expected answer."
          : "Generate coding or problem-solving questions when relevant. correctAnswer should contain the solution.";

    const result = await callAI({
      systemPrompt: "You are an expert quiz generator. Use only the provided extracted PDF content. Return valid JSON only.",
      prompt: `Generate ${numQuestions} ${difficulty} ${questionType} questions from this PDF.

${typeInstruction}

Return a JSON array:
[
  {
    "id": 1,
    "question": "question text",
    ${questionType === "mcq" ? '"options": ["A) option1", "B) option2", "C) option3", "D) option4"],' : ""}
    "correctAnswer": "correct answer text",
    "explanation": "why this is correct",
    "topic": "relevant topic"
  }
]

PDF: "${doc.filename}"
Subject: ${doc.analysis.subject}
Difficulty: ${doc.analysis.difficulty}
Extracted PDF content:
${doc.extractedText.substring(0, 10000)}`,
      jsonMode: true,
      temperature: 0.6,
    });

    let questionsRaw = parseAIJson<any>(result.content);
    
    // If the parsed JSON is an object, try to extract the array of questions
    if (questionsRaw && typeof questionsRaw === "object" && !Array.isArray(questionsRaw)) {
      if (Array.isArray(questionsRaw.questions)) {
        questionsRaw = questionsRaw.questions;
      } else if (Array.isArray(questionsRaw.quiz)) {
        questionsRaw = questionsRaw.quiz;
      } else if (Array.isArray(questionsRaw.data)) {
        questionsRaw = questionsRaw.data;
      } else {
        // Search for any array property in the object
        const keys = Object.keys(questionsRaw);
        for (const key of keys) {
          if (Array.isArray(questionsRaw[key])) {
            questionsRaw = questionsRaw[key];
            break;
          }
        }
      }
    }

    const questions = questionsRaw as QuizQuestion[];
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("AI returned invalid quiz format");
    }

    const title = `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} ${questionType.toUpperCase()} Quiz - ${doc.filename}`;
    const mongo = await getMongoDb();
    const now = new Date();
    const insert = await mongo.collection("ai_quizzes").insertOne({
      userId: user.id,
      documentId,
      title,
      difficulty,
      questionType,
      questions,
      totalQuestions: questions.length,
      provider: result.provider,
      model: result.model,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(aiActivityLog).values({
      userId: user.id,
      agentName: "Quiz & Evaluation",
      action: `Generated ${questions.length} ${questionType} questions (${difficulty})`,
      status: "success",
      provider: result.provider,
    });

    const quiz = await mongo.collection("ai_quizzes").findOne({ _id: insert.insertedId });
    return NextResponse.json({ quiz: { ...quiz, id: insert.insertedId.toString(), _id: undefined } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate quiz" },
      { status: 500 },
    );
  }
}
