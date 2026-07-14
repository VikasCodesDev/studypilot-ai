import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { userSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAIStatus } from "@/lib/ai-provider";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    return NextResponse.json({
      settings: settings || { theme: "dark", language: "en", notifications: true, emailNotifications: true },
      aiStatus: getAIStatus(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, theme, language, notifications, emailNotifications } = body;

    // Update user name if provided
    if (name) {
      await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, user.id));
    }

    // Upsert settings
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    if (existing) {
      await db
        .update(userSettings)
        .set({
          theme: theme ?? existing.theme,
          language: language ?? existing.language,
          notifications: notifications ?? existing.notifications,
          emailNotifications: emailNotifications ?? existing.emailNotifications,
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, user.id));
    } else {
      await db.insert(userSettings).values({
        userId: user.id,
        theme: theme || "dark",
        language: language || "en",
        notifications: notifications ?? true,
        emailNotifications: emailNotifications ?? true,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
