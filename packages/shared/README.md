# `@tinyworld/shared`

**The only package imported by both `apps/server` and `apps/web`.** Anything that needs to be byte-identical on both sides — message types, constants, the deterministic movement step — lives here. If you change movement, change it here and *nowhere else*.

```
src/
  protocol.ts   ClientMsg / ServerMsg types, EntityKind, Dir, the SnapMsg shape,
                the DIR_* / KIND_* maps used by the binary codec
  entity.ts     Entity type, SPEED, HITBOX, the shared step() (called by both
                the server for authority and the client for prediction),
                createEntity() factory
  snapCodec.ts  encodeSnap() / decodeSnap() — the packed DataView frame on the
                20 Hz hot path. decodeSnap returns the same SnapMsg shape the
                JSON path produces, so downstream code is identical.
  index.ts      re-exports the three above
```

## Why this package exists

The whole point of the netcode is *the server and the client run the same function on the same inputs and end up at the same place*. If the server has one movement formula and the client has another, reconciliation always produces a visible snap. There is **one** `step()`, exported at `entity.ts:57`, and both sides call it.

Same logic for the snapshot format. The JSON path and the binary path both produce a `SnapMsg`; downstream consumers (`Game.ts`, `LocalPlayer.ts`, `RemoteEntity.ts`, the server's `Snapshot.ts`) see the same object regardless of the wire format.

## Build

```bash
pnpm --filter @tinyworld/shared build     # tsc → dist/
pnpm --filter @tinyworld/shared dev       # tsc --watch
```

The other packages and apps depend on `dist/`, so **build this package first** when you change it. The root `pnpm build` does it in the right order (shared → world → web → server).

## Adding a field to a snapshot

If you extend `SnapMsg` or `EntitySnapshot`:

1. Add it to the JSON shape in `protocol.ts`.
2. Add the encode/decode in `snapCodec.ts` (and a `DIR_*` / `KIND_*` entry if it's a new `Dir` / `EntityKind`).
3. Have the server populate it in `apps/server/src/game/Snapshot.ts` and the client read it where it needs to.

Forgetting step 2 is the most common bug here — the JSON path will look correct and the binary path will silently drop the field.
