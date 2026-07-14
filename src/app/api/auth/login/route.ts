import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await authenticateUser(email.toLowerCase().trim(), password);
    await createSession(user.id);

    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Login failed";
    console.error("[auth/login] failed:", err);

    if (msg === "Invalid email or password") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Authentication service is unavailable" },
      { status: 500 },
    );
  }
}
