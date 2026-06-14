# `@tinyworld/server`

The authoritative game server. One Node + uWebSockets.js process owns the world, ticks at 20 Hz, serves the built client + `/metrics` + `/plain` + the WebSocket endpoint, and (optionally) writes ghosts / notes / bans / daily stats / the persisted goals counter to Postgres.

## Run

```bash
# dev (auto-restart on change)
pnpm --filter @tinyworld/server dev

# production-style: build everything then run the compiled server
pnpm build
node apps/server/dist/index.js
```

The server listens on `:3000` by default (override with `PORT`).

## What lives here

```
src/
  index.ts        uWebSockets.js app: WS, /metrics, /healthz, /plain, /admin, static client
  env.ts          loads repo-root .env for local dev; ignored in production
  metrics.ts      prom-client registry: tick histogram + summary, CCU, entities, snap byte/msg counters
  discord.ts      empty-world → first-visitor webhook (disabled unless DISCORD_WEBHOOK_URL is set)
  plain.ts        server-rendered accessible HTML version of all portfolio content
  game/
    Game.ts       the world loop — setInterval(20Hz) → gameTick() → broadcastSnapshot()
    Client.ts     one WebSocket connection: input validation, rate limits, seq tracking
    Snapshot.ts   builds and broadcasts a SnapMsg (binary or JSON) to all clients
    Ball.ts       server-authoritative ball physics (circle on circle, kick impulse)
    Cat.ts        NPC cat wander
    Dog.ts        NPC dog wander
    Ghosts.ts     records paths, persists to DB, replays 6–12 anonymized wanderers
    Notes.ts      chalk notes + moderation (rate limits, wordlist, reports, fade, kill-switch)
    ghostCodec.ts binary path codec for ghost replays
    Names.ts      generated visitor name pool (e.g. "Curious Capybara")
    Counters.ts   in-memory counters mirrored to the DB goals counter
  db/
    index.ts      exports `db` — null when DATABASE_URL is unset
    schema.ts     Drizzle schema (sessions, ghosts, notes, bans, stats_daily)
```

The **hot loop is `Game.gameTick`**. It calls `step()` from `@tinyworld/shared` for every player, steps the ball / cats / dog, then `broadcastSnapshot()` writes one frame per client (binary or JSON, gated by `SNAP_BINARY`) and times itself via `observeTick` in `metrics.ts`.

## Environment variables

Every variable is optional. The world runs with **all of them unset**; features switch off instead of crashing.

| Variable | Default | Effect when unset | Notes |
| --- | --- | --- | --- |
| `PORT` | `3000` | — | HTTP + WS port. |
| `SNAP_BINARY` | `true` | — | Set to `false` to send JSON snapshots (the bandwidth baseline). |
| `DATABASE_URL` | unset | ghosts, chalk notes, persisted goals are disabled; in-memory state still works | Neon pooled connection string; `prepare: false` is set in the client. |
| `NOTE_SALT` | `"dev-salt-change-me"` | — | Salt for IP hashing (rate limits & bans). **Set a real secret in prod.** |
| `ADMIN_PASS` | unset | `/admin` page is disabled | Add `ADMIN_USER` (default `admin`) for basic auth. |
| `DISCORD_WEBHOOK_URL` | unset | visitor-arrival webhook disabled | Fires only on the empty → first-visitor transition, max once per 5 min. |
| `NOTES_ENABLED` | `true` | — | Set to `false` for an instant kill-switch on chalk notes. |

`.env` is loaded from the **repo root** by `env.ts` for local dev; production (Railway) sets the vars directly and the missing file is ignored.

## Endpoints

- `GET /` — built client (`apps/web/dist`) in production; empty in local dev (use the Vite server on `:5173`).
- `GET /ws` — WebSocket game endpoint (binary snapshots + JSON control).
- `GET /metrics` — Prometheus exposition.
- `GET /healthz` — liveness.
- `GET /plain` — server-rendered, accessible HTML version of all portfolio content (SEO + a11y).
- `GET /admin` — moderation page (basic auth, only when `ADMIN_PASS` is set).

## Database

```bash
# one-time: push the schema to your DATABASE_URL
pnpm --filter @tinyworld/server run db:push
```

The Drizzle schema is in `src/db/schema.ts`. `db` from `src/db/index.ts` is **`null` when `DATABASE_URL` is unset** — every DB use is guarded with `if (!db) return` so the world keeps working without a database.

> **Gotcha:** `drizzle-kit push` can error re-diffing the `bans` text primary key (`42P16`). The schema is already applied; ignore unless you changed `schema.ts`, in which case `drop table bans;` and re-push.

## Observability

`metrics.ts` is a single `prom-client` registry. Useful series:

- `tinyworld_tick_duration_ms` (Histogram + Summary) — `observeTick` in `Game.gameTick` times the whole tick
- `tinyworld_ccu` (Gauge) — current connected players
- `tinyworld_entities` (Gauge) — entity count in the latest snapshot
- `tinyworld_snap_bytes_total` / `tinyworld_snap_msgs_total` (Counters) — egress, set in `Snapshot.broadcastSnapshot`

Local Grafana + Prometheus: see [`infra/grafana/README.md`](../../infra/grafana/README.md). Load test: [`infra/k6/README.md`](../../infra/k6/README.md).
