import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = {
    postgres: false,
    mongodb: false,
  };

  try {
    await db.execute(sql`select 1`);
    status.postgres = true;
  } catch {
    status.postgres = false;
  }

  try {
    const mongo = await getMongoDb();
    await mongo.command({ ping: 1 });
    status.mongodb = true;
  } catch {
    status.mongodb = false;
  }

  return Response.json(
    { ok: status.postgres && status.mongodb, ...status },
    { status: status.postgres && status.mongodb ? 200 : 503 },
  );
}
