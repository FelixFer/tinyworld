import type { Dir, EmoteKind, EventMsg, SnapMsg, WelcomeMsg } from "@tinyworld/shared";
import { GOAL_RECT } from "@tinyworld/shared";
import { CollisionGrid, VILLAGE_MAP } from "@tinyworld/world";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { createSocket } from "../net/socket.js";
import { Camera } from "./Camera.js";
import { DayNight } from "./DayNight.js";
import { Emotes } from "./Emotes.js";
import { ExhibitMarkers } from "./Exhibits.js";
import { createInput } from "./Input.js";
import { LocalPlayer } from "./LocalPlayer.js";
import { MapRenderer } from "./MapRenderer.js";
import { RemoteEntity } from "./RemoteEntity.js";

export interface GameInstance {
  app: Application;
  /** Drive movement from a virtual joystick: normalized dx/dy in [-1, 1], up is negative y. */
  setJoystick: (dx: number, dy: number) => void;
  /** Broadcast an emote from the local player. */
  sendEmote: (kind: EmoteKind) => void;
  destroy: () => void;
}

const JOY_DEADZONE = 0.3;

/** Static, world-space marker for the ball's goal zone. */
function makeGoalZone(): Container {
  const zone = new Container();
  const gfx = new Graphics();
  gfx
    .rect(GOAL_RECT.x, GOAL_RECT.y, GOAL_RECT.width, GOAL_RECT.height)
    .fill({ color: 0x4ecdc4, alpha: 0.18 })
    .stroke({ color: 0x4ecdc4, width: 2 });
  zone.addChild(gfx);
  const label = new Text({
    text: "⚽ GOAL",
    style: new TextStyle({ fontSize: 8, fill: "#ffffff", stroke: { color: "#000000", width: 2 } }),
  });
  label.anchor.set(0.5, 0.5);
  label.x = GOAL_RECT.x + GOAL_RECT.width / 2;
  label.y = GOAL_RECT.y + GOAL_RECT.height / 2;
  zone.addChild(label);
  return zone;
}

export interface GameCallbacks {
  onPlayerCount?: (count: number) => void;
  onNearExhibit?: (id: string | null) => void;
  onPing?: (ms: number) => void;
  onStatus?: (status: "connected" | "disconnected") => void;
  onGoals?: (goals: number) => void;
}

export async function initGame(
  container: HTMLElement,
  callbacks: GameCallbacks = {},
): Promise<GameInstance> {
  const { onPlayerCount, onNearExhibit, onPing, onStatus, onGoals } = callbacks;
  const app = new Application();

  await app.init({
    background: "#1a1a2e",
    resizeTo: container,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);

  const mapRenderer = new MapRenderer(VILLAGE_MAP);
  const exhibitMarkers = new ExhibitMarkers();
  const goalZone = makeGoalZone();
  const emotes = new Emotes();
  emotes.container.zIndex = 1000; // always above avatars
  const dayNight = new DayNight();
  dayNight.resize(app.screen.width, app.screen.height);
  const collision = new CollisionGrid(VILLAGE_MAP);
  let lastNearId: string | null = null;
  const camera = new Camera(
    app.screen.width,
    app.screen.height,
    mapRenderer.widthPx,
    mapRenderer.heightPx,
  );

  const remoteEntities = new Map<string, RemoteEntity>();
  let localPlayer: LocalPlayer | null = null;
  let serverTimeOffset = 0;
  let lastServerTick = 0;
  let hasReceivedWelcome = false;

  const onResize = () => {
    camera.resize(app.screen.width, app.screen.height);
    dayNight.resize(app.screen.width, app.screen.height);
  };
  app.renderer.on("resize", onResize);

  const socket = createSocket({
    onPing: (ms) => {
      serverTimeOffset = ms / 2;
      onPing?.(ms);
    },
    onOpen: () => {
      // Send any stored reconnect token so the server can rebind our avatar.
      let storedToken: string | undefined;
      try {
        storedToken = localStorage.getItem("tinyworld_token") ?? undefined;
      } catch {
        // localStorage may be unavailable (private mode, etc.)
      }
      socket.sendHello(undefined, storedToken);
      onStatus?.("connected");
    },
    onClose: () => {
      onStatus?.("disconnected");
    },
    onWelcome: (msg: WelcomeMsg) => {
      // Store token for reconnection
      try {
        localStorage.setItem("tinyworld_token", msg.token);
      } catch {
        // localStorage might be unavailable
      }

      console.log(
        "Welcome received, selfId:",
        msg.selfId,
        "entities:",
        msg.snapshot.entities.length,
      );
      console.log(
        "Snapshot entities:",
        msg.snapshot.entities.map((e) => ({ id: e.id, name: e.name })),
      );

      const selfEntity = msg.snapshot.entities.find((e) => e.id === msg.selfId);
      const spawnX = selfEntity?.x ?? VILLAGE_MAP.spawn.x;
      const spawnY = selfEntity?.y ?? VILLAGE_MAP.spawn.y;
      localPlayer = new LocalPlayer(msg.selfId, spawnX, spawnY, "You");
      camera.container.addChild(localPlayer.container);
      hasReceivedWelcome = true;
      console.log("Created LocalPlayer with entityId:", localPlayer.entityId);

      for (const entity of msg.snapshot.entities) {
        if (entity.id !== msg.selfId) {
          console.log("Creating remote entity from welcome:", entity.id, entity.name);
          const remote = new RemoteEntity(entity.id, entity, entity.kind);
          remoteEntities.set(entity.id, remote);
          camera.container.addChild(remote.container);
        }
      }
    },
    onSnap: (msg: SnapMsg) => {
      if (!hasReceivedWelcome) {
        console.log("Ignoring snap before welcome");
        return;
      }

      onPlayerCount?.(msg.playerCount);
      onGoals?.(msg.goals);
      dayNight.sync(msg.timeOfDay);

      lastServerTick = msg.tick;
      const serverTime = performance.now() / 1000 + serverTimeOffset / 1000;

      for (const entity of msg.entities) {
        if (entity.id === localPlayer?.entityId) {
          localPlayer.reconcile(entity, collision);
        } else {
          let remote = remoteEntities.get(entity.id);
          if (!remote) {
            console.log(
              "Creating remote entity from snap:",
              entity.id,
              entity.name,
              "localPlayerId:",
              localPlayer?.entityId,
            );
            remote = new RemoteEntity(entity.id, entity, entity.kind);
            remoteEntities.set(entity.id, remote);
            camera.container.addChild(remote.container);
          }
          remote.addSnapshot(msg.tick, entity);
        }
      }

      for (const [id, remote] of remoteEntities) {
        if (!msg.entities.some((e) => e.id === id)) {
          console.log("Removing remote entity:", id);
          remote.container.destroy();
          remoteEntities.delete(id);
        }
      }
    },
    onEvent: (msg: EventMsg) => {
      if (msg.kind === "leave") {
        const payload = msg.payload as { id: string };
        const remote = remoteEntities.get(payload.id);
        if (remote) {
          remote.container.destroy();
          remoteEntities.delete(payload.id);
        }
      } else if (msg.kind === "emote") {
        const payload = msg.payload as { id: string; kind: EmoteKind };
        const lp = localPlayer;
        if (lp && payload.id === lp.entityId) {
          emotes.spawn(payload.kind, () => ({ x: lp.container.x, y: lp.container.y }));
        } else {
          const remote = remoteEntities.get(payload.id);
          if (remote) {
            emotes.spawn(payload.kind, () => ({ x: remote.container.x, y: remote.container.y }));
          }
        }
      }
    },
  });

  const input = createInput();

  const setJoystick = (dx: number, dy: number) => {
    input.left = dx < -JOY_DEADZONE;
    input.right = dx > JOY_DEADZONE;
    input.up = dy < -JOY_DEADZONE;
    input.down = dy > JOY_DEADZONE;
  };

  camera.container.sortableChildren = true;
  camera.container.addChild(mapRenderer.container);
  camera.container.addChild(goalZone);
  camera.container.addChild(exhibitMarkers.container);
  camera.container.addChild(emotes.container);
  app.stage.addChild(camera.container);
  app.stage.addChild(dayNight.container); // screen-space tint, above the world

  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000;
    const serverTime = performance.now() / 1000 + serverTimeOffset / 1000;

    if (localPlayer) {
      localPlayer.update(dt, input, collision, socket.sendInput);
      const half = VILLAGE_MAP.tileSize / 2;
      const px = localPlayer.getEntity().x + half;
      const py = localPlayer.getEntity().y + half;
      camera.follow(px, py, dt);

      // Report the nearest interactable exhibit so the UI can prompt / open it.
      const near = exhibitMarkers.nearest(px, py)?.id ?? null;
      if (near !== lastNearId) {
        lastNearId = near;
        onNearExhibit?.(near);
      }
    }

    for (const remote of remoteEntities.values()) {
      remote.update(serverTime, dt);
    }

    emotes.update(dt);
    dayNight.update(dt);
  });

  return {
    app,
    setJoystick,
    sendEmote: socket.sendEmote,
    destroy: () => {
      socket.close();
      app.renderer.off("resize", onResize);
      app.destroy(true);
    },
  };
}
