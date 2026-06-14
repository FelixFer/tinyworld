# Tinyworld

A persistent multiplayer world — every visitor is an avatar, past visitors return as ghosts, and the netcode is the point. Walk around with WASD (or a virtual joystick on mobile), read project exhibits, kick a ball, wave at strangers.

**Live:** https://tinyworldweb-production.up.railway.app · **Plain version:** [`/plain`](https://tinyworldweb-production.up.railway.app/plain) · **Writeup:** [`BLOG.md`](BLOG.md)

> **By the numbers** — 20 Hz authoritative tick · client-side prediction + reconciliation · custom binary protocol **3.2× smaller** than JSON · server tick **p95 ~0.15 ms at 200 simulated clients**.

## What you can see and do

When you open the world:

- **Walk** with WASD / arrow keys, or a virtual joystick on touch.
- **Read the portfolio** — walk up to a sign and press **E** (or tap) to open a project exhibit: writeup, tech-stack tags, live/source links, screenshots. One exhibit is _this project itself_, showing the live player count.
- **See who's around** — a "N people here now" counter; other visitors move smoothly with name tags.
- **Meet the locals** — a wandering cat 🐱 and dog 🐶, and a kickable ball ⚽ with a persistent community-goals counter.
- **Emote** — wave / heart / ? / ! (keys **1–4** or the on-screen bar), broadcast to everyone.
- **Leave a chalk note** (**N**) — a short message dropped at your feet that everyone sees and that fades over 7 days.
- **Watch ghosts** — translucent, anonymized replays of where past visitors walked.
- **Day & night** — lighting tracks a server clock on a 10-minute cycle.
- **Read it plain** — [`/plain`](https://tinyworldweb-production.up.railway.app/plain) is a server-rendered, accessible HTML version of all portfolio content for crawlers, ATS parsers, and screen readers.

## Features (and what each proves)

- **Netcode — authoritative server, predicted client.** One Node process owns the world at a 20 Hz tick. Clients predict their own avatar via a single deterministic `step()` shared with the server, then reconcile by replaying unacknowledged inputs; everyone else is interpolated ~120 ms in the past. → _distributed-systems reasoning._
- **Portfolio layer.** Walk-up exhibits open accessible React modals; SEO meta + OG image; a server-rendered [`/plain`](https://tinyworldweb-production.up.railway.app/plain) page (Lighthouse-a11y oriented); mobile joystick + `prefers-reduced-motion`. → _accessibility maturity._
- **Aliveness.** Day/night on the server clock, emotes, NPC cat & dog, the kickable ball, and **ghosts** — recent visitors replayed as translucent, anonymized wanderers (paths only, salted IP hashes, never raw IPs). → _the detail people remember._
- **Chalk notes + moderation.** 140 chars, link-stripped, wordlist-filtered, rate-limited (1/min/session, 5/day/IP-hash); 2 reports auto-hide; basic-auth admin page; env kill-switch; notes fade over 7 days. → _product judgment, abuse thinking._
- **Binary snapshot protocol.** The 20 Hz snapshot is a packed `DataView` frame — **~3.2× less egress than JSON, measured** — while every other message stays JSON. Toggle with `SNAP_BINARY`. → _data-driven performance engineering._
- **Observability + load testing.** A Prometheus [`/metrics`](https://tinyworldweb-production.up.railway.app/metrics) endpoint (tick histogram/summary, CCU, egress counters), a local Grafana + Prometheus stack ([`infra/grafana`](infra/grafana)), a k6 200-CCU scenario ([`infra/k6`](infra/k6)), and a Discord webhook that pings you when a visitor arrives. → _ops literacy._

The full writeup — architecture, netcode, ghost privacy, and the binary-protocol before/after numbers — is in [`BLOG.md`](BLOG.md).

## Tech stack

| Layer       | Choice                                                  |
| ----------- | ------------------------------------------------------- |
| Language    | TypeScript, strict, end-to-end                          |
| Client      | PixiJS v8 (canvas) + React (DOM overlay) + Vite         |
| Server      | Node 22 + uWebSockets.js                                |
| Persistence | Postgres (Neon) + Drizzle ORM                           |
| Hosting     | Railway (Docker, one process serves client + WebSocket) |
| Tooling     | pnpm workspaces, Biome                                  |

## Repo layout

```
apps/web/         Vite + React + PixiJS client
apps/server/      Node + uWebSockets.js game server (+ Drizzle/Postgres)
packages/shared/  protocol types, constants, the shared sim step()
packages/world/   tile map, collision, exhibit content
```

## Local development

**Prerequisites:** Node 22+ and pnpm.

```bash
pnpm install
```

Run the server and client in two terminals:

```bash
pnpm --filter @tinyworld/server dev   # WebSocket + game loop on :3000
pnpm --filter @tinyworld/web dev      # Vite client on :5173 (connects to :3000)
```

Open http://localhost:5173.

### Database (optional locally)

Ghosts, chalk notes, and the persisted goals counter need Postgres. Without a database the world runs fully — those features are just disabled.

1. Create a free [Neon](https://neon.tech) project and copy the **pooled** connection string.
2. Put it in a repo-root `.env` (gitignored):
   ```
   DATABASE_URL="postgresql://...-pooler...?sslmode=require"
   ```
3. Create the tables:
   ```bash
   pnpm --filter @tinyworld/server run db:push
   ```

## Common commands

```bash
pnpm build       # build all packages (shared → world → web → server)
pnpm typecheck   # strict typecheck across the workspace
pnpm lint        # Biome check
```

## Observability & load testing

The server exposes a Prometheus endpoint at `/metrics`.

```bash
# 1. build + run a single-origin server (serves client + WebSocket + /metrics)
pnpm build && node apps/server/dist/index.js     # :3000

# 2. local Grafana + Prometheus dashboard (auto-provisioned)
docker compose -f infra/docker-compose.yml up -d  # Grafana on :3001 (admin/admin)

# 3. drive load and watch the panels move
k6 run infra/k6/load.js                            # ramps to 200 concurrent clients
```

Details + how to read the numbers: [`infra/k6/README.md`](infra/k6/README.md) and [`infra/grafana/README.md`](infra/grafana/README.md). To compare the JSON vs binary protocol, run the server with `SNAP_BINARY=false` (baseline) then `SNAP_BINARY=true` (default).

## Deployment

Railway builds the multi-stage [`Dockerfile`](Dockerfile) and runs one process that serves both the static client (from `apps/web/dist`) and the WebSocket endpoint.

Railway **service variables**:

| Variable                               | Purpose                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `PORT`                                 | `3000`                                                                        |
| `DATABASE_URL`                         | Neon connection string (ghosts / notes / persisted goals)                     |
| `NOTE_SALT`                            | salt for IP hashing (rate limits & bans) — set a real secret in prod          |
| `ADMIN_PASS` (+ optional `ADMIN_USER`) | enables the basic-auth `/admin` moderation page; admin is disabled when unset |
| `DISCORD_WEBHOOK_URL` _(optional)_     | pings you when a visitor arrives at an empty world; disabled when unset       |
| `SNAP_BINARY` _(optional)_             | binary snapshot protocol; on by default, set `false` for the JSON baseline    |
| `NOTES_ENABLED` _(optional)_           | chalk-notes kill-switch; set `false` to disable instantly                     |

The world runs fully without the optional/DB variables — those features simply switch off.

CI (GitHub Actions) typechecks and builds on every push.

## License

MIT © Felix Ferdinand
