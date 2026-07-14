import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiActivityLog } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getMongoDb } from "@/lib/mongodb";
import { listPdfDocuments } from "@/lib/mongo-documents";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mongo = await getMongoDb();
    const [
      docCount,
      noteCount,
      quizCount,
      attemptCount,
      planCount,
      coachCount,
      recentAttempts,
      recentActivity,
      recentDocuments,
    ] = await Promise.all([
      mongo.collection("ai_documents").countDocuments({ userId: user.id }),
      mongo.collection("ai_notes").countDocuments({ userId: user.id }),
      mongo.collection("ai_quizzes").countDocuments({ userId: user.id }),
      mongo.collection("ai_quiz_attempts").countDocuments({ userId: user.id }),
      mongo.collection("ai_study_plans").countDocuments({ userId: user.id }),
      mongo
        .collection("ai_coaching_reports")
        .countDocuments({ userId: user.id }),
      mongo
        .collection("ai_quiz_attempts")
        .find({ userId: user.id })
        .sort({ completedAt: -1 })
        .limit(20)
        .toArray(),
      db
        .select()
        .from(aiActivityLog)
        .where(eq(aiActivityLog.userId, user.id))
        .orderBy(desc(aiActivityLog.createdAt))
        .limit(10),
      listPdfDocuments(user.id),
    ]);

    const avgScore = recentAttempts.length
      ? recentAttempts.reduce(
          (sum, attempt) => sum + Number(attempt.score || 0),
          0,
        ) / recentAttempts.length
      : 0;
    const allWeak = recentAttempts.flatMap(
      (attempt) => (attempt.weakTopics || []) as string[],
    );
    const allStrong = recentAttempts.flatMap(
      (attempt) => (attempt.strongTopics || []) as string[],
    );

    const topWeak = topCounts(allWeak);
    const topStrong = topCounts(allStrong);
    const scoreTrend = [...recentAttempts].reverse().map((attempt, index) => ({
      attempt: index + 1,
      score: Math.round(Number(attempt.score || 0)),
      date: new Date(attempt.completedAt).toISOString().split("T")[0],
    }));

    return NextResponse.json({
      stats: {
        documents: docCount,
        notes: noteCount,
        quizzes: quizCount,
        attempts: attemptCount,
        studyPlans: planCount,
        coachingReports: coachCount,
        avgScore: Math.round(avgScore),
      },
      weakTopics: topWeak.map(([topic, count]) => ({ topic, count })),
      strongTopics: topStrong.map(([topic, count]) => ({ topic, count })),
      scoreTrend,
      recentActivity,
      recentDocuments: recentDocuments.slice(0, 5),
    });
  } catch (err) {
    console.error("[api/analytics][GET] failed", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to fetch analytics",
      },
      { status: 500 },
    );
  }
}

function topCounts(values: string[]) {
  const counts = values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
}
