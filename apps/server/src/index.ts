import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ClientMsg,
  EventMsg,
  HelloMsg,
  InputMsg,
  PingMsg,
  PongMsg,
  ServerMsg,
  SnapMsg,
  WelcomeMsg,
} from "@tinyworld/shared";
import { entityToSnapshot } from "@tinyworld/shared";
import { VILLAGE_MAP } from "@tinyworld/world";
import type uWS from "uWebSockets.js";
import uWSLib from "uWebSockets.js";
import { ClientTracker } from "./game/Client.js";
import { ServerGame } from "./game/Game.js";
import { generateName } from "./game/Names.js";
import { SnapshotManager } from "./game/Snapshot.js";

interface ClientWebSocket extends uWS.WebSocket<unknown> {
  clientId?: string;
}

const PORT = Number(process.env.PORT) || 3000;
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "..", "..", "public");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

const game = new ServerGame();
const clients = new ClientTracker();
const snapshots = new SnapshotManager();
const connectedWebSockets = new Set<ClientWebSocket>();

game.start();

// Periodic cleanup of disconnected entities (every 1s, 5s grace)
setInterval(() => {
  game.cleanupDisconnected(5000);
}, 1000);

const app = uWSLib.App();

function sendToAll(msg: ServerMsg, excludeWs?: ClientWebSocket): void {
  const json = JSON.stringify(msg);
  for (const ws of connectedWebSockets) {
    if (ws !== excludeWs) {
      ws.send(json, false);
    }
  }
}

function broadcastSnapshot(): void {
  const { snapshot, isKeyframe } = snapshots.generateSnapshot(game);

  // Only count and include connected (non-disconnected) entities
  const activeEntities = Array.from(game.entities.values()).filter((e) => e.disconnectedAt === 0);

  const msg: SnapMsg = {
    type: "snap",
    tick: snapshot.tick,
    baseTick: isKeyframe ? undefined : snapshot.tick - 1,
    entities: activeEntities.map(entityToSnapshot),
    playerCount: activeEntities.length,
  };

  sendToAll(msg);
}

setInterval(broadcastSnapshot, 50);

app
  .get("/healthz", (res) => {
    res.writeHeader("Content-Type", "application/json").end(
      JSON.stringify({
        ok: true,
        entities: game.entities.size,
        tick: game.currentTick,
      }),
    );
  })
  .ws("/ws", {
    compression: 0,
    maxPayloadLength: 16 * 1024,
    idleTimeout: 10,

    open(ws) {
      const clientId = Math.random().toString(36).slice(2, 10);

      // Check for reconnect token in the URL query string
      // (sent on first hello message; we assign tokens here)
      const token = Math.random().toString(36).slice(2);

      // Check if there's an existing disconnected entity we can reconnect
      const existing = game.findEntityByToken(token);
      if (existing && existing.disconnectedAt > 0) {
        console.log(`Reconnecting entity: ${existing.id} -> ${clientId} (${existing.name})`);
        game.reconnectEntity(existing, clientId);
        clients.addClient(clientId, clientId);
        (ws as ClientWebSocket).clientId = clientId;

        const welcome: WelcomeMsg = {
          type: "welcome",
          selfId: clientId,
          token,
          mapVersion: 1,
          snapshot: {
            tick: game.currentTick,
            entities: Array.from(game.entities.values())
              .filter((e) => e.disconnectedAt === 0)
              .map(entityToSnapshot),
          },
        };
        ws.send(JSON.stringify(welcome), false);
        connectedWebSockets.add(ws);
        console.log(`Entity count after reconnect: ${game.entities.size}`);
        return;
      }

      const name = generateName();
      const spawnX = VILLAGE_MAP.spawn.x;
      const spawnY = VILLAGE_MAP.spawn.y;

      (ws as ClientWebSocket).clientId = clientId;

      // Clean up orphaned entities (entities without active WebSocket connections)
      const activeClientIds = new Set<string>();
      for (const existingWs of connectedWebSockets) {
        const existingId = (existingWs as ClientWebSocket).clientId;
        if (existingId) {
          activeClientIds.add(existingId);
        }
      }

      for (const [entityId, entity] of game.entities) {
        if (!activeClientIds.has(entityId) && entity.disconnectedAt === 0) {
          console.log(`Cleaning up orphaned entity: ${entityId} (${entity.name})`);
          game.removeEntity(entityId);
          clients.removeClient(entityId);
        }
      }

      connectedWebSockets.add(ws);
      game.addEntity(clientId, spawnX, spawnY, name, token);
      clients.addClient(clientId, clientId);

      console.log(`Entity count after add: ${game.entities.size}`);
      console.log(
        `All entities: ${Array.from(game.entities.values())
          .map((e) => `${e.id}(${e.name})`)
          .join(", ")}`,
      );

      const welcome: WelcomeMsg = {
        type: "welcome",
        selfId: clientId,
        token,
        mapVersion: 1,
        snapshot: {
          tick: game.currentTick,
          entities: Array.from(game.entities.values())
            .filter((e) => e.disconnectedAt === 0)
            .map(entityToSnapshot),
        },
      };

      ws.send(JSON.stringify(welcome), false);

      const joinEvent: EventMsg = {
        type: "event",
        kind: "join",
        payload: { id: clientId, name },
      };
      sendToAll(joinEvent, ws);

      console.log(`client connected: ${clientId} (${name})`);
    },

    message(ws, message) {
      const clientId = (ws as ClientWebSocket).clientId;
      if (!clientId) return;

      let msg: ClientMsg;
      try {
        msg = JSON.parse(Buffer.from(message).toString()) as ClientMsg;
      } catch {
        return;
      }

      switch (msg.type) {
        case "hello": {
          const hello = msg as HelloMsg;
          const serverEntity = game.getEntity(clientId);
          if (serverEntity && hello.name) {
            serverEntity.name = hello.name;
          }
          break;
        }

        case "input": {
          const input = msg as InputMsg;
          if (!clients.canAcceptInput(clientId)) return;

          const serverEntity = game.getEntity(clientId);
          if (serverEntity) {
            serverEntity.queueInput({
              entityId: clientId,
              seq: input.seq,
              dt: input.dt,
              dx: input.dx,
              dy: input.dy,
            });
            clients.updateLastInputSeq(clientId, input.seq);
          }
          break;
        }

        case "ping": {
          const ping = msg as PingMsg;
          const pong: PongMsg = {
            type: "pong",
            t: ping.t,
            serverTime: Date.now(),
          };
          ws.send(JSON.stringify(pong), false);
          clients.updatePing(clientId, Date.now() - ping.t);
          break;
        }
      }
    },

    close(ws) {
      connectedWebSockets.delete(ws);

      const clientId = (ws as ClientWebSocket).clientId;
      if (clientId) {
        // Mark as disconnected instead of removing immediately (5s grace period)
        game.markDisconnected(clientId);
        clients.removeClient(clientId);

        console.log(`Entity count after disconnect: ${game.entities.size}`);

        const leaveEvent: EventMsg = {
          type: "event",
          kind: "leave",
          payload: { id: clientId },
        };
        sendToAll(leaveEvent);

        console.log(`client disconnected: ${clientId}`);
      }
    },
  })
  .get("/*", (res, req) => {
    const url = req.getUrl();
    const rel = url === "/" ? "index.html" : url.slice(1);
    const filePath = join(PUBLIC_DIR, rel);
    const ext = filePath.slice(filePath.lastIndexOf("."));
    try {
      const data = readFileSync(filePath);
      res.writeHeader("Content-Type", MIME[ext] ?? "application/octet-stream").end(data);
    } catch {
      try {
        const data = readFileSync(join(PUBLIC_DIR, "index.html"));
        res.writeHeader("Content-Type", "text/html; charset=utf-8").end(data);
      } catch {
        res.writeStatus("404 Not Found").end("Not found");
      }
    }
  })
  .listen(PORT, (token) => {
    if (token) {
      console.log(`tinyworld listening on :${PORT}`);
    } else {
      console.error(`Failed to listen on :${PORT}`);
      process.exit(1);
    }
  });
