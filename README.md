# tinyworld

A persistent multiplayer portfolio — a tiny game world where every visitor is an avatar, past visitors return as ghosts, and the netcode is the point. Walk around with WASD (or a virtual joystick on mobile), read project exhibits, kick a ball, wave at strangers.

**Live:** https://tinyworldweb-production.up.railway.app · **Plain version:** [`/plain`](https://tinyworldweb-production.up.railway.app/plain)

## What's inside

- **Authoritative netcode** — one Node process owns the world at a 20 Hz tick. Clients predict their own avatar and reconcile against the server by replaying unacknowledged inputs; everyone else is interpolated ~120 ms in the past. The movement sim is a single deterministic `step()` shared by client and server.
- **Portfolio layer** — walk-up exhibits open accessible React modals; a server-rendered [`/plain`](https://tinyworldweb-production.up.railway.app/plain) page carries the same content for crawlers, ATS parsers, and screen readers.
- **Aliveness** — day/night tied to the server clock, emotes, wandering NPC cat & dog, a kickable ball with a community goals counter, and **ghosts**: recent visitors replayed as translucent, anonymized wanderers.

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

## Deployment

Railway builds the multi-stage [`Dockerfile`](Dockerfile) and runs one process that serves both the static client (from `apps/web/dist`) and the WebSocket endpoint.

Required Railway **service variables**:

- `PORT` — `3000`
- `DATABASE_URL` — your Neon connection string (for ghosts/notes/persisted goals)

CI (GitHub Actions) typechecks and builds on every push.

## License

MIT © Felix Ferdinand
