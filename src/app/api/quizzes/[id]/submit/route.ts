import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import { callAI } from "@/lib/ai-provider";
import { getMongoDb } from "@/lib/mongodb";
import type { QuizQuestion, UserAnswer } from "@/db/schema";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { answers } = (await req.json()) as { answers: Record<number, string> };
    if (!answers || Object.keys(answers).length === 0) {
      return NextResponse.json({ error: "Answers are required" }, { status: 400 });
    }

    const mongo = await getMongoDb();
    const quiz = await mongo.collection("ai_quizzes").findOne({ _id: new ObjectId(id), userId: user.id });
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    const questions = quiz.questions as QuizQuestion[];
    const evaluatedAnswers: UserAnswer[] = [];
    let correct = 0;
    const weakTopicSet = new Set<string>();
    const strongTopicSet = new Set<string>();

    for (const q of questions) {
      const userAnswer = answers[q.id] || "";
      const isCorrect =
        userAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase() ||
        q.correctAnswer.toLowerCase().includes(userAnswer.trim().toLowerCase());
      if (isCorrect) {
        correct++;
        if (q.topic) strongTopicSet.add(q.topic);
      } else if (q.topic) {
        weakTopicSet.add(q.topic);
      }
      evaluatedAnswers.push({ questionId: q.id, userAnswer, isCorrect });
    }

    const score = (correct / questions.length) * 100;
    const feedbackResult = await callAI({
      systemPrompt: "You are an educational coach providing quiz feedback. Use the quiz result data only.",
      prompt: `A student scored ${correct}/${questions.length} (${score.toFixed(1)}%) on "${quiz.title}".
Weak topics: ${[...weakTopicSet].join(", ") || "None"}
Strong topics: ${[...strongTopicSet].join(", ") || "None"}

Provide brief feedback with specific improvement suggestions.`,
      temperature: 0.7,
      maxTokens: 300,
    });

    const now = new Date();
    const insert = await mongo.collection("ai_quiz_attempts").insertOne({
      userId: user.id,
      quizId: id,
      documentId: quiz.documentId,
      answers: evaluatedAnswers,
      score,
      totalQuestions: questions.length,
      correctAnswers: correct,
      feedback: feedbackResult.content,
      weakTopics: [...weakTopicSet],
      strongTopics: [...strongTopicSet],
      provider: feedbackResult.provider,
      model: feedbackResult.model,
      completedAt: now,
    });

    await db.insert(aiActivityLog).values({
      userId: user.id,
      agentName: "Quiz & Evaluation",
      action: `Quiz submitted: ${score.toFixed(1)}% (${correct}/${questions.length})`,
      status: "success",
      provider: feedbackResult.provider,
      details: `Weak: ${[...weakTopicSet].join(", ") || "None"}`,
    });

    const attempt = await mongo.collection("ai_quiz_attempts").findOne({ _id: insert.insertedId });
    return NextResponse.json({ attempt: { ...attempt, id: insert.insertedId.toString(), _id: undefined }, questions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit quiz" },
      { status: 500 },
    );
  }
}
