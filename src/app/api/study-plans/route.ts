import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import { callAI, parseAIJson } from "@/lib/ai-provider";
import { getMongoDb } from "@/lib/mongodb";
import { getPdfDocument } from "@/lib/mongo-documents";
import type { StudyPlanItem } from "@/db/schema";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mongo = await getMongoDb();
    const plans = await mongo.collection("ai_study_plans").find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({
      plans: plans.map((plan) => ({ ...plan, id: plan._id.toString(), _id: undefined })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch plans" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, documentId, examDate, hoursPerDay } = await req.json();
    if (!type) return NextResponse.json({ error: "Plan type is required" }, { status: 400 });

    const doc = documentId ? await getPdfDocument(user.id, documentId) : null;
    const mongo = await getMongoDb();
    const attempts = await mongo.collection("ai_quiz_attempts").find({ userId: user.id }).sort({ completedAt: -1 }).limit(10).toArray();

    const avgScore = attempts.length ? attempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / attempts.length : 0;
    const weakTopics = attempts.flatMap((attempt) => (attempt.weakTopics || []) as string[]);
    const weakCounts = weakTopics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topWeak = Object.entries(weakCounts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([topic]) => topic);

    const result = await callAI({
      systemPrompt: "You are an expert study planner. Use extracted PDF data and quiz history only. Return valid JSON only.",
      prompt: `Create a ${type} study plan.
${examDate ? `Exam date: ${examDate}` : ""}
${hoursPerDay ? `Available hours per day: ${hoursPerDay}` : ""}
${doc ? `PDF: ${doc.filename}
Subject: ${doc.analysis.subject}
Difficulty: ${doc.analysis.difficulty}
Chapters: ${doc.analysis.chapters.join(", ")}
Topics: ${doc.analysis.topics.join(", ")}
Concepts: ${doc.analysis.concepts.join(", ")}
Summary: ${doc.analysis.summary}
` : "Use the student's MongoDB quiz and document history."}
Performance: ${attempts.length ? `Average quiz score ${avgScore.toFixed(1)}%. Weak topics: ${topWeak.join(", ") || "none"}.` : "No quiz attempts yet."}

Return JSON:
{
  "title": "plan title",
  "items": [
    {
      "day": "day name or date",
      "time": "suggested time slot",
      "topic": "what to study",
      "duration": "e.g., 1 hour",
      "priority": "high/medium/low",
      "notes": "brief tip"
    }
  ]
}`,
      jsonMode: true,
      temperature: 0.6,
    });

    const planData = parseAIJson<{ title: string; items: StudyPlanItem[] }>(result.content);
    const now = new Date();
    const insert = await mongo.collection("ai_study_plans").insertOne({
      userId: user.id,
      documentId: documentId || null,
      type,
      title: planData.title,
      plan: planData.items,
      status: "active",
      provider: result.provider,
      model: result.model,
      startDate: now,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(aiActivityLog).values({
      userId: user.id,
      agentName: "Study Planner",
      action: `Generated ${type} study plan: ${planData.title}`,
      status: "success",
      provider: result.provider,
    });

    const plan = await mongo.collection("ai_study_plans").findOne({ _id: insert.insertedId });
    return NextResponse.json({ plan: { ...plan, id: insert.insertedId.toString(), _id: undefined } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate study plan" },
      { status: 500 },
    );
  }
}
