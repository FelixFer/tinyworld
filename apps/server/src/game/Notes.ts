import { createHash } from "node:crypto";
import type { Note } from "@tinyworld/shared";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";
import { db } from "../db/index.js";
import { bans, notes } from "../db/schema.js";

const MAX_LEN = 140;
const SESSION_COOLDOWN_MS = 60_000; // 1 note / min / session
const DAILY_IP_LIMIT = 5; // 5 notes / day / ip hash
const FADE_DAYS = 7;
const REPORT_THRESHOLD = 2; // reports before auto-hide

const NOTES_ENABLED = process.env.NOTES_ENABLED !== "false"; // env kill-switch
const SALT = process.env.NOTE_SALT ?? "dev-salt-change-me";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/** Salted hash of an IP — we never store or log raw IPs. */
export function ipHash(ip: string): string {
  return createHash("sha256").update(`${SALT}:${ip}`).digest("hex").slice(0, 32);
}

function sanitize(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/gi, "") // strip links
    .replace(/www\.\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LEN);
}

function toNote(row: typeof notes.$inferSelect): Note {
  return { id: row.id, text: row.text, x: row.x, y: row.y, createdAt: row.createdAt.getTime() };
}

type CreateResult =
  | { ok: true; note: Note }
  | { ok: false; code: "rate_limited" | "banned" | "note_rejected" };

export class NotesManager {
  private readonly lastBySession = new Map<string, number>();

  get enabled(): boolean {
    return NOTES_ENABLED && db !== null;
  }

  async create(
    text: string,
    x: number,
    y: number,
    clientId: string,
    hash: string,
  ): Promise<CreateResult> {
    if (!this.enabled || !db) return { ok: false, code: "note_rejected" };
    if (await this.isBanned(hash)) return { ok: false, code: "banned" };

    const clean = sanitize(text);
    if (clean.length === 0 || matcher.hasMatch(clean)) return { ok: false, code: "note_rejected" };

    const now = Date.now();
    if (now - (this.lastBySession.get(clientId) ?? 0) < SESSION_COOLDOWN_MS) {
      return { ok: false, code: "rate_limited" };
    }
    const since = new Date(now - 86_400_000);
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(notes)
      .where(and(eq(notes.ipHash, hash), gt(notes.createdAt, since)));
    if (c >= DAILY_IP_LIMIT) return { ok: false, code: "rate_limited" };

    const [row] = await db.insert(notes).values({ text: clean, x, y, ipHash: hash }).returning();
    this.lastBySession.set(clientId, now);
    return { ok: true, note: toNote(row) };
  }

  /** Increment report count; returns the note id if it just got auto-hidden. */
  async report(noteId: number): Promise<number | null> {
    if (!db) return null;
    const [row] = await db
      .update(notes)
      .set({ reportCount: sql`${notes.reportCount} + 1` })
      .where(and(eq(notes.id, noteId), isNull(notes.hiddenAt)))
      .returning();
    if (!row) return null;
    if (row.reportCount >= REPORT_THRESHOLD) {
      await db.update(notes).set({ hiddenAt: new Date() }).where(eq(notes.id, noteId));
      return noteId;
    }
    return null;
  }

  async loadActive(): Promise<Note[]> {
    if (!db) return [];
    const since = new Date(Date.now() - FADE_DAYS * 86_400_000);
    const rows = await db
      .select()
      .from(notes)
      .where(and(isNull(notes.hiddenAt), gt(notes.createdAt, since)))
      .orderBy(desc(notes.createdAt))
      .limit(200);
    return rows.map(toNote);
  }

  // --- moderation ---
  async isBanned(hash: string): Promise<boolean> {
    if (!db) return false;
    const [b] = await db.select().from(bans).where(eq(bans.ipHash, hash)).limit(1);
    return !!b && (!b.expiresAt || b.expiresAt.getTime() > Date.now());
  }

  async deleteNote(id: number): Promise<void> {
    if (!db) return;
    await db.update(notes).set({ hiddenAt: new Date() }).where(eq(notes.id, id));
  }

  /** Ban the author of a note (by its stored ip hash). Returns the banned hash, if found. */
  async banByNote(id: number, reason: string): Promise<string | null> {
    if (!db) return null;
    const [row] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
    if (!row) return null;
    await db.insert(bans).values({ ipHash: row.ipHash, reason }).onConflictDoNothing();
    await db.update(notes).set({ hiddenAt: new Date() }).where(eq(notes.ipHash, row.ipHash));
    return row.ipHash;
  }

  /** All notes for the admin view (includes hidden). */
  async adminList(): Promise<(Note & { hidden: boolean; reports: number })[]> {
    if (!db) return [];
    const rows = await db.select().from(notes).orderBy(desc(notes.createdAt)).limit(200);
    return rows.map((r) => ({ ...toNote(r), hidden: r.hiddenAt !== null, reports: r.reportCount }));
  }
}
