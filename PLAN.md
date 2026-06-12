# tinyworld — project plan

> Working title: **tinyworld** (rename freely). One-line pitch: *my portfolio is a tiny persistent multiplayer world — every visitor is an avatar, past visitors wander as ghosts, and the netcode is the resume.*

## 1. Design pillars

Every feature must pass all four. If it fails one, it goes to `ICEBOX.md`.

1. **Ten seconds to wow** — no signup, no tutorial. One page load and you're walking around.
2. **Never looks dead** — ghosts, ambient life, day/night. An empty server must still feel alive.
3. **Resume first** — portfolio content is always one tap away, and a plain-HTML `/plain` version exists for crawlers, ATS parsers, screen readers, and recruiters in a hurry.
4. **Numbers or it didn't happen** — every system is observable. The load-test writeup is a first-class deliverable, not an afterthought.

## 2. Architecture

- **One authoritative game process** (Node) owns the world state in memory and ticks at 20 Hz.
- **Browsers** render at 60 fps, predict their own avatar locally, and interpolate everyone else ~100–150 ms in the past.
- **Postgres** persists only the small durable things: chalk notes, ghost paths, daily stats, bans.
- **One Fly.io machine** serves both the static client and the WebSocket endpoint. Deliberately boring infrastructure, deliberately interesting netcode. The scale-out story (sharding by room) gets *designed* and written up, not built.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript end-to-end, strict mode | One language; the movement sim is shared between client (prediction) and server (authority) |
| Client rendering | PixiJS v8 + Vite | Batched WebGL sprites with a small API — you still own the game loop, which is the point |
| UI shell | React (DOM overlay on the canvas) | Exhibits, HUD, and note composer live in accessible, SEO-able DOM — never canvas text |
| World authoring | Tiled editor → JSON | Visual map editing with collision layers |
| Art | Kenney / itch.io 16 px asset packs | Consistent style for $0–20 instead of weeks of pixel-pushing |
| Server | Node 22 + uWebSockets.js | Far faster than `ws` (C++ core), built-in backpressure handling |
| State | In-memory world, single process | Honest about scale; Redis only earns its place when a second process exists |
| Persistence | Postgres (Neon free tier) + Drizzle | Notes, ghosts, stats, bans — low write rate, serverless PG is fine |
| Protocol | JSON v0 → custom binary (DataView) v1 | Ship fast, then measure the bandwidth win and publish it |
| Hosting | Fly.io shared-cpu-1x + Docker | WebSocket-friendly, ~$5/month |
| CI/CD | GitHub Actions | Typecheck + build + deploy on push to main, from day one |
| Observability | pino logs, Sentry (client), prom-client + Grafana Cloud free (M5) | The blog post needs graphs |
| Load testing | k6 WebSocket scenarios | The headline numbers |
| Tooling | pnpm workspaces, Biome | Monorepo, fast lint/format |

**Deliberately NOT used (and say so in the writeup):**
- **Phaser / Colyseus / PartyKit / Liveblocks** — they'd do the interesting part for you. The netcode *is* the portfolio.
- **Redis on day 1** — single process needs no shared state. Cargo-culting infra is a red flag; resisting it is a talking point.
- **Kubernetes** — it's one box.
- **Accounts/auth** — visitors get generated names ("Curious Capybara"). No login wall, no PII, no GDPR surface. Store salted IP hashes only, for rate limits and bans.

**Repo layout (pnpm workspaces):**

```
tinyworld/
  apps/web/        # Vite + React + PixiJS client
  apps/server/     # Node + uWebSockets.js game server
  packages/shared/ # protocol types, constants, shared sim step()
  packages/world/  # Tiled maps, spritesheets, collision data
  infra/           # Dockerfile, fly.toml, k6 scenarios, GH Actions
```

> ⚠️ Create the repo **outside OneDrive** (e.g. `C:\dev\tinyworld`). `node_modules` inside a synced folder means file locks, sync churn, and mysterious breakage.

## 4. Feature spec

### R1 — It moves (milestones M1–M2)
- Tile map rendered from Tiled JSON; camera follows player; collision.
- Avatar: WASD/arrows + click/tap-to-move, 4-direction walk animation, name tag.
- Multiplayer: join/leave, smooth remote movement (interpolation), own-avatar prediction.
- Generated visitor names; "N people here now" counter.
- Disconnect grace (5 s), reconnect, tab-visibility handling.

### R2 — It's a portfolio (M3) → **soft launch**
- 4–6 exhibits: walk up, press E / tap → React modal with project writeup, links, media. One exhibit is *this project itself* (live CCU graph = meta flex).
- About-me sign, contact mailbox.
- Mobile: virtual joystick, responsive HUD, iOS Safari quirks handled (audio unlock on gesture, `dvh` units).
- `/plain` — server-rendered plain HTML of all portfolio content. Lighthouse a11y ≥ 95. `prefers-reduced-motion` respected.
- SEO meta + OG image (a screenshot of the world).

### R3 — It's inhabited (M4)
- **Ghosts**: recent visitors replayed as translucent wanderers (see §6).
- **Chalk notes**: short messages on designated surfaces, fading over 7 days (see §7).
- **Emotes**: wave, heart, ?, ! — broadcast to everyone.
- **The ball**: server-authoritative circle physics, kickable, a goal with a global "community goals: 1,204" counter.
- Day/night tied to server clock; ambient audio + footsteps; an NPC cat that wanders.

### R4 — It's a story (M5)
- Binary protocol v1; publish JSON-vs-binary bandwidth numbers.
- k6 load tests to 200 simulated clients; tune tick cost; publish p95s.
- `/metrics` + Grafana dashboard (CCU, tick duration, bandwidth).
- Discord webhook: "someone is reading your resume — go say hi" (killer interview demo).
- Blog post + launch (§15).

### Icebox (ideas park here, not in scope)
Minimap, seasonal weather, pet that follows you, konami easter egg, spectator mode at capacity, gamepad support, voice zones, localization.

## 5. Netcode design (the core)

- **Authoritative server, 20 Hz fixed tick.** Clients send inputs (≤30/s, sequence-numbered). Server validates: speed clamp, teleport rejection, flood → kick.
- **Own avatar**: client-side prediction; on each snapshot, reconcile by replaying unacknowledged inputs. Requires deterministic shared `step()` in `packages/shared`.
- **Remote avatars**: interpolation buffer rendering 100–150 ms behind server time. Clock offset estimated from ping/pong EMA.
- **Snapshots**: keyframe every 2 s, deltas (changed entities only) in between.
- **Interest management**: skipped below ~100 CCU in one map — but the spatial-grid design goes in the blog post.

Protocol sketch (v0 JSON, same shape in binary v1):

```ts
// client → server
hello   { name? }                       // once per session
input   { seq, dt, dir }                // ≤30/s, seq enables reconciliation
emote   { kind }                        // wave | heart | question | bang
kick    { dir }                         // ball impulse
note    { text, x, y }                  // heavily rate-limited
ping    { t }

// server → client
welcome { selfId, mapVersion, snapshot }
snap    { tick, baseTick?, entities[] } // delta vs keyframe
event   { join | leave | emote | note | goal }
pong    { t, serverTime }               // clock sync
error   { code }                        // rate_limited | banned | full
```

References to build against (don't reinvent the theory): Gabriel Gambetta's *Fast-Paced Multiplayer* series, Glenn Fiedler's networking articles. Snapshot interpolation only — **no rollback netcode**, that's a different project.

## 6. Ghost system

- Record server-side at 4 Hz, positions quantized to 1/16 tile, delta + varint encoded (~1–2 KB/min).
- Persist on session end if the visit lasted ≥ 60 s and moved ≥ 30 tiles. Keep the most recent 200; GC the rest.
- Replay 6–12 ghosts concurrently, recency-weighted, translucent, non-interactive, anonymized names.
- Privacy: paths only — no text, no identity. Salted IP hashes, never raw IPs. A short `/privacy` page says exactly this.

## 7. Chalk notes + moderation

UGC is the riskiest feature, so it ships **only together with its admin tools**:

- Designated chalkboard zones; 140 chars; link stripping + wordlist filter (`obscenity`).
- Cooldowns: 1/min per session, 5/day per IP hash.
- **Notes fade over 7 days** (opacity = age) — thematic *and* the moderation backlog cleans itself.
- 2 reports → auto-hide pending review. Admin page (basic auth): delete, ban IP hash.
- Env kill-switch to disable notes instantly.

## 8. Database schema (sketch)

```sql
sessions    (id, started_at, ended_at, ip_hash, ua_class)
ghosts      (id, session_id, path bytea, duration_s, created_at)
notes       (id, text, x, y, session_id, ip_hash, created_at, hidden_at, report_count)
bans        (ip_hash, reason, expires_at)
stats_daily (date, visitors, peak_ccu, notes_left, goals)
```

## 9. Roadmap

| # | Milestone | Est. | Exit criterion |
|---|---|---|---|
| M0 | Foundations — monorepo, Docker, CI/CD, live deploy | 4–6 h | Prod URL shows a sprite + live "ping: 43 ms" WS round-trip |
| M1 | Walking skeleton — map, camera, collision, animation | 10–15 h | You walk around your world, on prod |
| M2 | Multiplayer core — tick loop, prediction, interpolation | 15–25 h | Two phones, two avatars, smooth at 100 ms+ ping |
| M3 | Portfolio layer — exhibits, mobile, /plain, SEO | 8–12 h | **Replaces your current portfolio link (soft launch)** |
| M4 | Aliveness — ghosts, notes + moderation, ball, day/night | 15–20 h | World feels inhabited when you're alone in it |
| M5 | Scale & story — binary protocol, k6, Grafana, blog, launch | 10–15 h | 200-CCU test passes; writeup published |

**Total: ~62–93 h** ≈ 8–10 weekends, or ~2 months at ~1.5 h/weeknight. M2 is the hard one — budget accordingly and don't start it tired.

## 10. Ops & cost

- Fly.io shared-cpu-1x ≈ $5/mo · Neon free · Cloudflare DNS · Sentry/Grafana Cloud free tiers · UptimeRobot free.
- GH Actions: typecheck + build + deploy on main. Deploy from M0 onward — ops pain is front-loaded on purpose.
- **Cost ceiling: ~$6/month + domain.** (A `.gg` domain is on-brand but pricey ~$70/yr; any personal domain works.)

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Scope creep (game projects breed ideas) | Pillars test (§1) + ICEBOX.md; release lists are frozen once started |
| Art becomes a time sink | Asset pack, one evening to choose, $0–20 budget, credit the artist |
| Netcode rabbit hole | Snapshot interpolation only; Gambetta series is the spec; no rollback, no physics engine beyond one circle |
| World feels dead at launch | Ghosts + cat + day/night ship *before* the public launch |
| UGC abuse | Notes gated on admin tools; kill-switch; hashed IPs; fade-out |
| iOS Safari quirks | Test on a real phone from M1, not at the end |
| Burnout / life happens | M3 soft launch means the project pays off even if M4–M5 slip |

## 12. Success metrics

**Technical** (publish these):
- p95 server tick < 10 ms, p99 < 16 ms at 200 simulated CCU on one shared-cpu-1x.
- Egress < 12 KB/s/client on JSON v0; < 4 KB/s on binary v1 (measure the actual win).
- 60 fps on a mid-tier laptop; TTI < 2 s on 4G; Lighthouse a11y ≥ 95 on `/plain`; uptime ≥ 99%.

**Outcome**: median session > 2 min (recruiters who stay are recruiters who remember); strangers leave notes; the writeup travels; you walk into interviews with three deep stories (prediction/reconciliation, moderation design, load-test tuning).

## 13. What it proves (interview mapping)

- Prediction + reconciliation + clock sync → **distributed-systems reasoning**
- Binary protocol with before/after numbers → **data-driven performance engineering**
- Moderation pipeline + rate limiting → **product judgment, abuse thinking**
- `/plain`, reduced-motion, DOM overlay → **accessibility maturity**
- Docker, CI/CD, k6, Grafana → **ops literacy**
- Ghosts → **the creative detail people remember you by**

## 14. M0 checklist (first session)

1. `C:\dev\tinyworld` — git init, pnpm workspace, Biome, strict TS. (Outside OneDrive!)
2. `apps/server`: uWS hello + `/healthz` + WS echo. `apps/web`: Vite + React + Pixi canvas with one sprite and a live ping readout. `packages/shared`: message type stubs.
3. Multi-stage Dockerfile → `fly launch` → custom domain + TLS.
4. GH Actions: typecheck + build + deploy on main.
5. UptimeRobot on `/healthz`.

## 15. Launch plan

- **Soft launch (after M3):** the world becomes your portfolio link in bio/CV.
- **Full launch (after M5):** blog post — "My portfolio is a tiny MMO" — covering architecture, netcode with GIFs, ghost privacy design, k6 graphs, the $6/month bill, and lessons learned. Post to Show HN / LinkedIn / X. The world itself gets a meta-exhibit with the live CCU graph.
