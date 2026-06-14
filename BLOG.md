# My portfolio is a tiny MMO

Most portfolios are a list of links. Mine is a place you walk into. Open
[tinyworld](https://tinyworldweb-production.up.railway.app) and you're an avatar
in a small persistent world — there are project exhibits to walk up to, a ball
to kick, a cat and a dog wandering around, and the translucent ghosts of people
who visited before you. There's no signup and no tutorial. You're moving within
ten seconds.

The point isn't the game. The point is that **the netcode is the resume.**

## The shape of it

One authoritative Node process owns the world in memory and ticks at 20 Hz.
Browsers render at 60 fps with PixiJS, predict their own avatar locally, and
interpolate everyone else about 120 ms in the past. Postgres (Neon) persists
only the small durable things — chalk notes, ghost paths, the community goals
counter, bans. One Railway box serves both the static client and the WebSocket
endpoint. Deliberately boring infrastructure; deliberately interesting netcode.

```
apps/web/        Vite + React + PixiJS client
apps/server/     Node + uWebSockets.js game server
packages/shared/ protocol types, constants, the shared sim step()
packages/world/  tile map, collision, exhibit content
```

The whole thing is TypeScript, strict, end-to-end. That matters for exactly one
reason, which turns out to be the most interesting part.

## Netcode: one `step()`, two callers

The classic browser-game bug is the rubber-band: you walk, then half a second
later the server yanks you back. It happens when the client and server disagree
about what an input _means_.

So there is exactly one movement function — `step(state, input, isSolid)` — and
it lives in `packages/shared`. The client calls it to **predict** its own avatar
the instant you press a key. The server calls the _same function on the same
inputs_ to compute authority. Because they're identical, reconciliation lands
with zero correction.

The loop:

1. Client samples input, tags it with a sequence number, applies `step()`
   locally (prediction), and sends it.
2. Server processes each queued input in order through `step()`, advancing a
   per-entity `lastInputSeq`.
3. Each snapshot carries that `lastInputSeq` as an ack. The client drops
   acknowledged inputs, snaps to the server position, and **replays the
   unacknowledged ones** through `step()` again.

Remote avatars are different — you can't predict other people, so you render
them in the past. Snapshots land in a buffer and get interpolated ~120 ms
behind server time. Smooth, at the cost of a little latency you never notice.

No rollback netcode. Snapshot interpolation only. That's a different project,
and saying so is part of the point: I know where the line is.

## Everything alive is a server entity

The cat, the dog, the ball, the ghosts — none of them are client animations.
They're all server-authoritative entities, appended to every broadcast
snapshot, and rendered client-side purely by their `kind`. The client never
simulates them; it just interpolates them like any other remote thing. Adding a
new kind of life is three small edits: a `kind` in the protocol, an update step
on the server, a render branch on the client.

That's how the world "never looks dead" even when you're alone in it.

## Ghosts, and not being creepy

When a session ends, if the visit lasted at least 60 seconds and moved at least
30 tiles, the server keeps its path. Paths are recorded at 4 Hz and
delta-encoded down to roughly 2 bytes per sample. We keep the most recent 200
and replay 6–12 at a time, translucent and anonymized.

The privacy line is hard and stated plainly: **paths only — no text, no
identity, salted IP hashes, never raw IPs.** A ghost is a trail of where someone
walked, nothing more. It's the detail people remember, and it costs almost
nothing to store.

## Chalk notes ship with their own police

User-generated content is the riskiest feature, so it shipped _only_ alongside
its moderation tools. Notes are 140 chars, link-stripped, run through a wordlist
filter. Rate limits: 1 per minute per session, 5 per day per IP hash. Two
reports auto-hide a note pending review. There's a basic-auth admin page to
delete and ban, and an environment kill-switch to disable the whole feature
instantly.

And the notes **fade over 7 days** — which is thematic _and_ means the
moderation backlog cleans itself.

## The number-driven part: a binary protocol

The headline metric is egress per client. Snapshots are ~all of it, and they
went out as JSON: readable, debuggable, and fat.

```
{"id":"a1b2c3d4","x":240.5,"y":176.25,"dir":"down","name":"Curious Capybara","lastInputSeq":9001,"kind":"player"}
```

That's ~110 bytes for one entity, most of it punctuation and field names
repeated for every entity, every snapshot, 20 times a second.

So I wrote a binary protocol — but only for the hot path. The periodic snapshot
became a packed `DataView` frame; every other message (the rare ones: welcome,
events, pong) stayed JSON. Per entity:

| field        | type             | notes               |
| ------------ | ---------------- | ------------------- |
| kind, dir    | `u8` each        | enum index          |
| x, y         | `i16` each       | quantized to 1/8 px |
| lastInputSeq | `u32`            | reconciliation ack  |
| id, name     | `u8` len + UTF-8 |                     |

About 36 bytes instead of 110. The client tells frames apart trivially: a binary
`ArrayBuffer` is a snapshot, text is everything else.

**The measurement** (`SNAP_BINARY=false` for the JSON baseline, then on; both
read off the server's own Prometheus counters under a k6 load of ~200
concurrent clients):

|                           | JSON v0  | Binary v1    |
| ------------------------- | -------- | ------------ |
| bytes / snapshot / client | 22,580   | 7,076        |
| egress / client           | 441 KB/s | **138 KB/s** |

**A 3.19× cut in bandwidth**, measured, not guessed.

Two honest caveats, because "numbers or it didn't happen" cuts both ways:

- The _absolute_ KB/s is high because there's **no interest management** yet —
  every client receives every player, so egress is O(N) per client. That's a
  deliberate "designed, not built" decision: below ~100 CCU in one map it
  doesn't earn its complexity, and the spatial-grid design is a blog section,
  not code. The binary **ratio** is the real win.
- The numbers above are from a single box where k6 and the server competed for
  the same CPU — so the absolute tick latency is, if anything, pessimistic; the
  real server isn't also generating its own load. The binary-vs-JSON _ratio_ is
  unaffected, since it's a byte count. M5 is deployed, so the live
  [`/metrics`](https://tinyworldweb-production.up.railway.app/metrics) endpoint
  is there to check.

## Tick cost under load

The other headline: how long does a 20 Hz tick take at 200 CCU? Target was p95
under 10 ms. Measured p95 was about **0.15 ms** — two orders of magnitude of
headroom. The work per tick is genuinely cheap: process queued inputs through
`step()`, update the ball / cat / dog / ghosts, sample paths at 4 Hz. No physics
engine beyond one circle.

Notably the tick cost is identical between the JSON and binary builds — because
serialization happens _outside_ the timed tick, in the broadcast. Exactly where
you'd expect it.

## Watching it: /metrics + Grafana

Everything is observable. The server exposes a Prometheus `/metrics` endpoint —
tick-duration histogram and summary, CCU and entity gauges, snapshot byte and
message counters. A `docker compose` stack (Prometheus + Grafana, dashboard
auto-provisioned) renders it locally, and the k6 scenario drives the load. The
graphs in this post came straight out of it.

## A Discord ping for the killer demo

When a visitor walks into the empty world, a Discord webhook fires: _"someone is
reading your resume — go say hi."_ Rate-limited so it never spams. In an
interview, that notification arriving live, on a portfolio that is itself a
running multiplayer system, is the whole pitch in one buzz.

## The bill

- Railway box: ~$5/month
- Neon Postgres: free tier
- Grafana / UptimeRobot: free tiers
- **Total: ~$6/month** plus a domain.

## What I deliberately didn't use

Phaser, Colyseus, PartyKit, Liveblocks — any of them would have done the
interesting netcode for me, and the netcode is the portfolio. No Redis on day
one: a single process has no shared state to coordinate. No Kubernetes: it's one
box. No accounts or auth: visitors get generated names like "Curious Capybara",
and the only thing stored about you is a salted hash, for rate limits.

Resisting infrastructure you don't need is itself a signal.

## What it proves

- Prediction + reconciliation + clock sync → distributed-systems reasoning.
- A binary protocol with before/after numbers → data-driven performance work.
- The moderation pipeline → product judgment and abuse thinking.
- `/plain`, reduced-motion, a DOM overlay over the canvas → accessibility.
- Docker, CI/CD, k6, Grafana → ops literacy.
- Ghosts → the creative detail people remember.

The repo is [here](https://github.com/FelixFer/tinyworld). Go say hi.
