import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

// Recorded visitor paths, replayed later as anonymized ghosts. Paths only — no identity.
export const ghosts = pgTable("ghosts", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(), // base64 of delta-encoded quantized positions
  durationS: integer("duration_s").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chalk notes left on the map (UGC).
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  ipHash: text("ip_hash").notNull(), // salted hash, never a raw IP
  createdAt: timestamp("created_at").defaultNow().notNull(),
  hiddenAt: timestamp("hidden_at"),
  reportCount: integer("report_count").default(0).notNull(),
});

// Banned IP hashes (moderation).
export const bans = pgTable("bans", {
  ipHash: text("ip_hash").primaryKey(),
  reason: text("reason"),
  expiresAt: timestamp("expires_at"),
});

// Persistent named counters (e.g. lifetime community goals).
export const counters = pgTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").default(0).notNull(),
});
