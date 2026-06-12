import type { Dir, EventMsg, SnapMsg, WelcomeMsg } from "@tinyworld/shared";
import { CollisionGrid, VILLAGE_MAP } from "@tinyworld/world";
import { Application } from "pixi.js";
import { createSocket } from "../net/socket.js";
import { Camera } from "./Camera.js";
import { createInput } from "./Input.js";
import { LocalPlayer } from "./LocalPlayer.js";
import { MapRenderer } from "./MapRenderer.js";
import { RemoteEntity } from "./RemoteEntity.js";

export interface GameInstance {
  app: Application;
  destroy: () => void;
}

export async function initGame(
  container: HTMLElement,
  onPlayerCount?: (count: number) => void,
): Promise<GameInstance> {
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
  const collision = new CollisionGrid(VILLAGE_MAP);
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
  };
  app.renderer.on("resize", onResize);

  const socket = createSocket({
    onPing: (ms) => {
      serverTimeOffset = ms / 2;
    },
    onOpen: () => {},
    onClose: () => {},
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
          const remote = new RemoteEntity(entity.id, entity);
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

      lastServerTick = msg.tick;
      const serverTime = performance.now() / 1000 + serverTimeOffset / 1000;

      for (const entity of msg.entities) {
        if (entity.id === localPlayer?.entityId) {
          localPlayer.reconcile(entity);
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
            remote = new RemoteEntity(entity.id, entity);
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
      }
    },
  });

  const input = createInput();

  camera.container.addChild(mapRenderer.container);
  app.stage.addChild(camera.container);

  app.ticker.add(() => {
    const dt = app.ticker.deltaMS / 1000;
    const serverTime = performance.now() / 1000 + serverTimeOffset / 1000;

    if (localPlayer) {
      localPlayer.update(dt, input, collision, socket.sendInput);
      camera.follow(
        localPlayer.getEntity().x + VILLAGE_MAP.tileSize / 2,
        localPlayer.getEntity().y + VILLAGE_MAP.tileSize / 2,
        dt,
      );
    }

    for (const remote of remoteEntities.values()) {
      remote.update(serverTime, dt);
    }
  });

  return {
    app,
    destroy: () => {
      socket.close();
      app.renderer.off("resize", onResize);
      app.destroy(true);
    },
  };
}
