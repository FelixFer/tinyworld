# `@tinyworld/world`

**Content-only package.** The actual map, the collision grid, and the portfolio exhibit copy. Imported by both `apps/server` (for collision checks during the tick) and `apps/web` (for the map renderer and the React modal content). No runtime behavior lives here — only data.

```
src/
  types.ts      Tile, Map, Exhibit types
  tiles.ts      tile ids, sprite lookup
  collision.ts  collision grid (built from the map at module load)
  exhibits.ts   the EXHIBITS array — the actual portfolio content (writeups, links,
                tech-stack tags, screenshots). Edit this to add or change a project.
  maps/
    village.ts  VILLAGE_MAP — the tile map
  index.ts      re-exports the above + VILLAGE_MAP
```

## Editing the portfolio

Each entry in `exhibits.ts` is a project: id, label, in-world position, the copy that shows up in the walk-up modal, links, tech stack. The modal is rendered by `apps/web/src/ui/ExhibitModal.tsx`. Edit the copy here, never in the UI component.

## Editing the map

`maps/village.ts` is a hand-authored tile map (Tiled JSON would also work; the project started that way and got hand-compacted). `collision.ts` derives the collision grid from the map at load time — solid tiles block movement, water/sand don't. Both the server and the client import the same module, so collision is identical on both sides.

## Build

```bash
pnpm --filter @tinyworld/world build
```

The server uses `@tinyworld/world` to validate positions in `gameTick`; the client uses it to render the map. If you change the map, make sure the Dockerfile's runner stage copies this package's `dist/` — the server imports `@tinyworld/world` at runtime, and a missing `dist/` in the image crashes production with `ERR_MODULE_NOT_FOUND` (local dev and CI won't catch this).
