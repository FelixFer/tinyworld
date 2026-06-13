import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { counters } from "../db/schema.js";

export async function loadCounter(name: string): Promise<number> {
  if (!db) return 0;
  const [row] = await db.select().from(counters).where(eq(counters.name, name)).limit(1);
  return row?.value ?? 0;
}

export async function saveCounter(name: string, value: number): Promise<void> {
  if (!db) return;
  await db
    .insert(counters)
    .values({ name, value })
    .onConflictDoUpdate({ target: counters.name, set: { value } });
}
