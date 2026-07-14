import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import { callAI, parseAIJson } from "@/lib/ai-provider";
import { getMongoDb } from "@/lib/mongodb";
import type { CoachingAnalysis } from "@/db/schema";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mongo = await getMongoDb();
    const reports = await mongo.collection("ai_coaching_reports").find({ userId: user.id }).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({
      reports: reports.map((report) => ({ ...report, id: report._id.toString(), _id: undefined })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch reports" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mongo = await getMongoDb();
    const [docCount, noteCount, planCount, attempts] = await Promise.all([
      mongo.collection("ai_documents").countDocuments({ userId: user.id }),
      mongo.collection("ai_notes").countDocuments({ userId: user.id }),
      mongo.collection("ai_study_plans").countDocuments({ userId: user.id }),
      mongo.collection("ai_quiz_attempts").find({ userId: user.id }).sort({ completedAt: -1 }).toArray(),
    ]);

    if (attempts.length === 0 && docCount === 0) {
      return NextResponse.json(
        { error: "Not enough data for analysis. Upload documents and take quizzes first." },
        { status: 400 },
      );
    }

    const avgScore = attempts.length ? attempts.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0) / attempts.length : 0;
    const allWeak = attempts.flatMap((attempt) => (attempt.weakTopics || []) as string[]);
    const allStrong = attempts.flatMap((attempt) => (attempt.strongTopics || []) as string[]);
    const topWeak = topCounts(allWeak);
    const topStrong = topCounts(allStrong);

    const result = await callAI({
      systemPrompt: "You are an educational performance coach. Analyze MongoDB AI learning history. Return valid JSON only.",
      prompt: `Analyze this student's learning data:
- PDFs uploaded: ${docCount}
- Notes generated: ${noteCount}
- Study plans created: ${planCount}
- Quiz attempts: ${attempts.length}
- Average quiz score: ${avgScore.toFixed(1)}%
- Weak topics: ${topWeak.map(([topic, count]) => `${topic} (${count}x)`).join(", ") || "None"}
- Strong topics: ${topStrong.map(([topic, count]) => `${topic} (${count}x)`).join(", ") || "None"}
- Recent scores: ${attempts.slice(0, 5).map((attempt) => `${Number(attempt.score || 0).toFixed(0)}%`).join(", ") || "None"}

Return JSON:
{
  "analysis": {
    "overallScore": 0-100,
    "strengths": ["list"],
    "weaknesses": ["list"],
    "learningSpeed": "fast/moderate/needs-improvement",
    "consistency": "high/moderate/low",
    "topicMastery": {"topic": 0-100}
  },
  "recommendations": ["actionable recommendations"],
  "priorities": ["ordered priorities"],
  "strategy": "strategy paragraph",
  "insights": "insights paragraph",
  "motivation": "motivational message"
}`,
      jsonMode: true,
      temperature: 0.6,
    });

    const coaching = parseAIJson<{
      analysis: CoachingAnalysis;
      recommendations: string[];
      priorities: string[];
      strategy: string;
      insights: string;
      motivation: string;
    }>(result.content);

    const now = new Date();
    const insert = await mongo.collection("ai_coaching_reports").insertOne({
      userId: user.id,
      ...coaching,
      provider: result.provider,
      model: result.model,
      createdAt: now,
    });

    await db.insert(aiActivityLog).values({
      userId: user.id,
      agentName: "Performance Coach",
      action: "Generated performance analysis report",
      status: "success",
      provider: result.provider,
    });

    const report = await mongo.collection("ai_coaching_reports").findOne({ _id: insert.insertedId });
    return NextResponse.json({ report: { ...report, id: insert.insertedId.toString(), _id: undefined } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate coaching report" },
      { status: 500 },
    );
  }
}

function topCounts(values: string[]) {
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
}
