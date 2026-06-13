import "../env.js"; // load .env before reading DATABASE_URL
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL;

/**
 * Drizzle handle, or null when DATABASE_URL is unset — the world still runs
 * fully without a database; only ghosts/notes/persisted-goals are disabled.
 * `prepare: false` keeps it compatible with Neon's pooled (PgBouncer) endpoint.
 */
export const db = url ? drizzle(postgres(url, { prepare: false }), { schema }) : null;

if (!db) {
  console.warn("DATABASE_URL not set — ghosts, notes, and persisted goals are disabled.");
}
