import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";

const SESSION_COOKIE = "studypilot_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createUser(
  email: string,
  name: string,
  password: string,
) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new Error("User already exists");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash, provider: "email" })
    .returning();
  return user;
}

export async function authenticateUser(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password");
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }
  return user;
}

export async function createSession(userId: number) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ userId, token, expiresAt });

  const cookieStore = await cookies();
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "";
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:
      forwardedProto === "https" ||
      (process.env.NODE_ENV === "production" && !isLocalhost),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return token;
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await db.delete(sessions).where(eq(sessions.token, token));
      }
      return null;
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        // avatarUrl/provider/createdAt are not required for auth flow.
        // Omitting them avoids runtime failures if the DB schema is missing those columns.
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    return user || null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
    cookieStore.delete(SESSION_COOKIE);
  }
}
