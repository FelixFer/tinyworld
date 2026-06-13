import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ClientMsg,
  EmoteMsg,
  EntitySnapshot,
  EventMsg,
  HelloMsg,
  InputMsg,
  PingMsg,
  PongMsg,
  ServerMsg,
  SnapMsg,
  WelcomeMsg,
} from "@tinyworld/shared";
import { DAY_CYCLE_MS, entityToSnapshot } from "@tinyworld/shared";
import { VILLAGE_MAP } from "@tinyworld/world";
import type uWS from "uWebSockets.js";
import uWSLib from "uWebSockets.js";
import { ClientTracker } from "./game/Client.js";
import { type ServerEntity, ServerGame } from "./game/Game.js";
import { generateName } from "./game/Names.js";
import { SnapshotManager } from "./game/Snapshot.js";
import { renderPlainPage } from "./plain.js";

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
const lastEmoteAt = new Map<string, number>();
const EMOTE_KINDS = new Set<EmoteMsg["kind"]>(["wave", "heart", "question", "bang"]);

// Portfolio content is static per deploy — render the plain page once.
const PLAIN_HTML = renderPlainPage();

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

  const cat = game.cat;
  const catSnap: EntitySnapshot = {
    id: "cat",
    x: Math.round(cat.x * 100) / 100,
    y: Math.round(cat.y * 100) / 100,
    dir: cat.dir,
    name: "",
    lastInputSeq: 0,
    kind: "cat",
  };

  const dog = game.dog;
  const dogSnap: EntitySnapshot = {
    id: "dog",
    x: Math.round(dog.x * 100) / 100,
    y: Math.round(dog.y * 100) / 100,
    dir: dog.dir,
    name: "",
    lastInputSeq: 0,
    kind: "dog",
  };

  const ball = game.ball;
  const ballSnap: EntitySnapshot = {
    id: "ball",
    x: Math.round(ball.x * 100) / 100,
    y: Math.round(ball.y * 100) / 100,
    dir: "down",
    name: "",
    lastInputSeq: 0,
    kind: "ball",
  };

  const msg: SnapMsg = {
    type: "snap",
    tick: snapshot.tick,
    baseTick: isKeyframe ? undefined : snapshot.tick - 1,
    entities: [...activeEntities.map(entityToSnapshot), catSnap, dogSnap, ballSnap],
    playerCount: activeEntities.length,
    timeOfDay: (Date.now() % DAY_CYCLE_MS) / DAY_CYCLE_MS,
    goals: game.goals,
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
      (ws as ClientWebSocket).clientId = clientId;
      connectedWebSockets.add(ws);
      // The entity is created when the client sends `hello` — that message
      // carries any reconnect token, which lets us rebind a disconnected
      // entity instead of always spawning a fresh one.
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

          // Already joined on this connection — just allow a name update.
          const current = game.getEntity(clientId);
          if (current) {
            if (hello.name) current.name = hello.name;
            break;
          }

          // Reconnect if the token matches a disconnected entity still in grace;
          // otherwise spawn a fresh entity with a new token.
          const previous = hello.token ? game.findEntityByToken(hello.token) : undefined;
          let entity: ServerEntity;
          let token: string;
          if (previous && previous.disconnectedAt > 0) {
            game.reconnectEntity(previous, clientId);
            entity = previous;
            token = previous.token;
            console.log(`reconnect: ${entity.name} -> ${clientId}`);
          } else {
            token = Math.random().toString(36).slice(2);
            entity = game.addEntity(
              clientId,
              VILLAGE_MAP.spawn.x,
              VILLAGE_MAP.spawn.y,
              hello.name ?? generateName(),
              token,
            );
            console.log(`join: ${entity.name} (${clientId})`);
          }
          clients.addClient(clientId, clientId);

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
            payload: { id: clientId, name: entity.name },
          };
          sendToAll(joinEvent, ws);
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

        case "emote": {
          const emote = msg as EmoteMsg;
          if (!EMOTE_KINDS.has(emote.kind)) break;
          const now = Date.now();
          if (now - (lastEmoteAt.get(clientId) ?? 0) < 400) break; // anti-spam cooldown
          lastEmoteAt.set(clientId, now);
          const ev: EventMsg = {
            type: "event",
            kind: "emote",
            payload: { id: clientId, kind: emote.kind },
          };
          sendToAll(ev);
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
        lastEmoteAt.delete(clientId);

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
  .get("/plain", (res) => {
    res.writeHeader("Content-Type", "text/html; charset=utf-8").end(PLAIN_HTML);
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
