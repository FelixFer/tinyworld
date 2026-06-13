import type { EntitySnapshot } from "@tinyworld/shared";
import { desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { ghosts } from "../db/schema.js";
import { type GhostSample, decodeGhostPath, encodeGhostPath } from "./ghostCodec.js";

const REPLAY_LIMIT = 12; // ghosts replayed concurrently
const KEEP = 200; // most recent ghosts retained in the DB

interface ReplayGhost {
  id: string;
  samples: GhostSample[];
  duration: number; // seconds (samples / 4Hz)
  playhead: number;
}

/** Loads recent ghost paths from the DB and replays them as looping, anonymized wanderers. */
export class GhostManager {
  private replays: ReplayGhost[] = [];

  async load(): Promise<void> {
    if (!db) return;
    const rows = await db.select().from(ghosts).orderBy(desc(ghosts.createdAt)).limit(REPLAY_LIMIT);
    this.replays = rows
      .map((r, i) => {
        const samples = decodeGhostPath(r.path);
        const duration = samples.length / 4;
        return { id: `ghost:${r.id}`, samples, duration, playhead: (i * 3.1) % Math.max(1, duration) };
      })
      .filter((g) => g.samples.length > 1);
    console.log(`Loaded ${this.replays.length} ghost(s) for replay.`);
  }

  async persist(samples: GhostSample[], durationS: number): Promise<void> {
    if (!db) return;
    await db.insert(ghosts).values({ path: encodeGhostPath(samples), durationS });
    // Keep only the most recent KEEP rows.
    await db.execute(
      sql`delete from ghosts where id not in (select id from ghosts order by created_at desc limit ${KEEP})`,
    );
  }

  advance(dt: number): void {
    for (const g of this.replays) {
      if (g.duration <= 0) continue;
      g.playhead += dt;
      if (g.playhead >= g.duration) g.playhead -= g.duration;
    }
  }

  snapshots(): EntitySnapshot[] {
    return this.replays.map((g) => {
      const t = g.playhead * 4;
      const i = Math.max(0, Math.min(Math.floor(t), g.samples.length - 2));
      const f = t - i;
      const a = g.samples[i];
      const b = g.samples[i + 1] ?? a;
      return {
        id: g.id,
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        dir: "down",
        name: "",
        lastInputSeq: 0,
        kind: "ghost",
      };
    });
  }
}
