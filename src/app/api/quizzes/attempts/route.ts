import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const mongo = await getMongoDb();
    const attempts = await mongo.collection("ai_quiz_attempts").find({ userId: user.id }).sort({ completedAt: -1 }).toArray();
    return NextResponse.json({
      attempts: attempts.map((attempt) => ({ ...attempt, id: attempt._id.toString(), _id: undefined })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch attempts" },
      { status: 500 },
    );
  }
}
