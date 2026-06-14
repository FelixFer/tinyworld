# `@tinyworld/web`

The browser client. Vite + React + PixiJS v8. The canvas does the world; React does the HUD, modals, and the mobile joystick. The whole thing is one React app (`App.tsx`) that mounts a PixiJS `Application` into a `<div>` and overlays accessible DOM UI on top.

## Run

```bash
pnpm --filter @tinyworld/web dev        # Vite dev server on :5173, connects to WS on :3000
pnpm --filter @tinyworld/web build      # builds to apps/web/dist (served by the prod server image)
pnpm --filter @tinyworld/web preview    # preview the built bundle
```

In local dev, the Vite dev server runs the client and the Node server runs the WebSocket; in production the multi-stage Docker image copies `apps/web/dist` into the server image and one process serves both.

## What lives here

```
src/
  main.tsx          React entry
  App.tsx           the only React component — owns UI state, mounts the Pixi game, wires keyboard/touch
  game/             PixiJS world (no React inside)
    Game.ts         initGame() — builds the Pixi Application, the scene, the systems
    Camera.ts       camera follow + deadzone
    MapRenderer.ts  tilemap + collision from @tinyworld/world
    DayNight.ts     overlay tint driven by server clock
    LocalPlayer.ts  input → predict via shared step() → send to server → reconcile on snap
    RemoteEntity.ts interpolated render of every other player / cat / dog / ball / ghost
    Input.ts        keyboard + virtual joystick → dx, dy
    Exhibits.ts     walk-up detection + open prompt
    Notes.ts        render + compose + report
    Emotes.ts       wave / heart / ? / ! bubbles
  net/
    socket.ts       WebSocket lifecycle; routes ArrayBuffer → decodeSnap, string → JSON
  ui/               DOM overlay (accessible, not canvas)
    EmoteBar.tsx    on-screen emote buttons + key hints
    ExhibitModal.tsx accessible modal: writeup, tech-stack tags, links, screenshots
    Joystick.tsx    touch-only virtual joystick
```

<img width="1918" height="982" alt="Image" src="https://github.com/user-attachments/assets/aeaad856-a774-4aaa-a5c4-61fead36cd90" />

## The netcode path (client side)

`net/socket.ts` opens the WebSocket and, importantly, sets `ws.binaryType = "arraybuffer"` — every snapshot frame from the server arrives as an `ArrayBuffer` and is routed through `decodeSnap` from `@tinyworld/shared`. Text frames take the JSON path. The result is a normal `SnapMsg` either way, so the rest of the client doesn't know or care.

`game/LocalPlayer.ts` is the prediction + reconciliation core:

- **Predict:** every input frame, it runs the **same** `step()` from `@tinyworld/shared` that the server runs, locally, and remembers the input by `inputSeq`.
- **Send:** the input is also sent to the server.
- **Reconcile:** on every snapshot, the server's `lastInputSeq` is the ack. We snap to the server position, drop the acknowledged inputs from the queue, and replay the rest through `step()`. When the prediction was right, the player doesn't visually correct.

`game/RemoteEntity.ts` is everything else. It keeps a small ring buffer of snapshots and renders each remote entity ~120 ms behind server time, smoothing motion.

## Keyboard

| Key           | Action                       |
| ------------- | ---------------------------- |
| WASD / arrows | move                         |
| E             | open nearby exhibit          |
| N             | open note composer           |
| 1–4           | emote (wave / heart / ? / !) |
| Esc           | close overlay                |

On touch devices the joystick replaces WASD and tap replaces E.

## Accessibility & UX

- All overlays are DOM, not canvas text — screen readers and keyboard focus work.
- `prefers-reduced-motion` is respected (camera deadzone, no shake).
- `100dvh` units — iOS Safari's URL bar is handled.
- Audio is unlocked only on user gesture.
- The meta exhibit on the live site shows the live CCU.
