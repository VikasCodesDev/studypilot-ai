import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, password } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    const user = await createUser(
      email.toLowerCase().trim(),
      name.trim(),
      password,
    );
    await createSession(user.id);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("[auth/register] failed:", err);

    if (err instanceof Error && err.message === "User already exists") {
      return NextResponse.json(
        { error: "Account already exists with this email" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Authentication service is unavailable" },
      { status: 500 },
    );
  }
}
