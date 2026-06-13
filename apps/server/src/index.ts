import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ClientMsg,
  EmoteMsg,
  EntitySnapshot,
  ErrorMsg,
  EventMsg,
  HelloMsg,
  InputMsg,
  NoteMsg,
  NotesMsg,
  PingMsg,
  PongMsg,
  ReportMsg,
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
import { NotesManager, ipHash } from "./game/Notes.js";
import { SnapshotManager } from "./game/Snapshot.js";
import { renderPlainPage } from "./plain.js";

interface ClientWebSocket extends uWS.WebSocket<unknown> {
  clientId?: string;
  ipHash?: string;
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
const notesMgr = new NotesManager();

// Basic-auth admin (disabled unless ADMIN_PASS is set).
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS;

function adminOk(req: uWS.HttpRequest): boolean {
  if (!ADMIN_PASS) return false;
  const h = req.getHeader("authorization");
  if (!h.startsWith("Basic ")) return false;
  const [u, p] = Buffer.from(h.slice(6), "base64").toString().split(":");
  return u === ADMIN_USER && p === ADMIN_PASS;
}

function denyAdmin(res: uWS.HttpResponse): void {
  res
    .writeStatus("401 Unauthorized")
    .writeHeader("WWW-Authenticate", 'Basic realm="tinyworld admin"')
    .end("Authentication required");
}

function adminEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderAdmin(
  list: { id: number; text: string; hidden: boolean; reports: number }[],
): string {
  const rows = list
    .map(
      (n) =>
        `<tr${n.hidden ? ' style="opacity:.5"' : ""}><td>${n.id}</td><td>${adminEsc(n.text)}</td><td>${n.reports}</td><td>${n.hidden ? "hidden" : ""}</td><td><a href="/admin/delete?id=${n.id}">delete</a> · <a href="/admin/ban?id=${n.id}">ban author</a></td></tr>`,
    )
    .join("");
  return `<!doctype html><meta charset="utf-8"><title>admin</title><style>body{font:14px system-ui;margin:24px}table{border-collapse:collapse}td{border:1px solid #ccc;padding:4px 8px}</style><h1>notes (${list.length})</h1><table><tr><th>id</th><th>text</th><th>reports</th><th></th><th></th></tr>${rows}</table>`;
}

// Portfolio content is static per deploy — render the plain page once.
const PLAIN_HTML = renderPlainPage();

game.start();
game.ghosts.load().catch((e) => console.error("ghost load failed", e));

// Cleanup disconnected entities past their 5s grace; persist ghost-worthy paths.
setInterval(() => {
  for (const g of game.cleanupDisconnected(5000)) {
    game.ghosts
      .persist(g.samples, g.durationS)
      .catch((e) => console.error("ghost persist failed", e));
  }
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
    entities: [
      ...activeEntities.map(entityToSnapshot),
      catSnap,
      dogSnap,
      ballSnap,
      ...game.ghosts.snapshots(),
    ],
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

    upgrade(res, req, context) {
      // Capture the real client IP (x-forwarded-for behind the Railway proxy).
      const xff = req.getHeader("x-forwarded-for");
      const ip =
        (xff ? xff.split(",")[0].trim() : "") ||
        Buffer.from(res.getRemoteAddressAsText()).toString();
      res.upgrade(
        { ip },
        req.getHeader("sec-websocket-key"),
        req.getHeader("sec-websocket-protocol"),
        req.getHeader("sec-websocket-extensions"),
        context,
      );
    },

    open(ws) {
      const { ip } = ws.getUserData() as { ip: string };
      const clientId = Math.random().toString(36).slice(2, 10);
      (ws as ClientWebSocket).clientId = clientId;
      (ws as ClientWebSocket).ipHash = ipHash(ip || "local");
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

          notesMgr
            .loadActive()
            .then((list) => {
              if (connectedWebSockets.has(ws as ClientWebSocket)) {
                const notesMsg: NotesMsg = { type: "notes", notes: list };
                ws.send(JSON.stringify(notesMsg), false);
              }
            })
            .catch((e) => console.error("notes load failed", e));
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

        case "note": {
          const note = msg as NoteMsg;
          const entity = game.getEntity(clientId);
          if (!entity) break;
          const hash = (ws as ClientWebSocket).ipHash ?? "local";
          const x = Math.round(entity.x + 8); // note dropped at the player's feet
          const y = Math.round(entity.y + 8);
          notesMgr
            .create(note.text, x, y, clientId, hash)
            .then((r) => {
              if (r.ok) {
                const ev: EventMsg = { type: "event", kind: "note", payload: r.note };
                sendToAll(ev);
              } else if (connectedWebSockets.has(ws as ClientWebSocket)) {
                const err: ErrorMsg = { type: "error", code: r.code };
                ws.send(JSON.stringify(err), false);
              }
            })
            .catch((e) => console.error("note create failed", e));
          break;
        }

        case "report": {
          const rep = msg as ReportMsg;
          notesMgr
            .report(rep.noteId)
            .then((hiddenId) => {
              if (hiddenId !== null) {
                const ev: EventMsg = {
                  type: "event",
                  kind: "note_removed",
                  payload: { id: hiddenId },
                };
                sendToAll(ev);
              }
            })
            .catch((e) => console.error("note report failed", e));
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
  .get("/admin", (res, req) => {
    if (!adminOk(req)) return denyAdmin(res);
    let aborted = false;
    res.onAborted(() => {
      aborted = true;
    });
    notesMgr.adminList().then((list) => {
      if (aborted) return;
      res.cork(() =>
        res.writeHeader("Content-Type", "text/html; charset=utf-8").end(renderAdmin(list)),
      );
    });
  })
  .get("/admin/delete", (res, req) => {
    if (!adminOk(req)) return denyAdmin(res);
    const id = Number(req.getQuery("id"));
    let aborted = false;
    res.onAborted(() => {
      aborted = true;
    });
    notesMgr.deleteNote(id).then(() => {
      const ev: EventMsg = { type: "event", kind: "note_removed", payload: { id } };
      sendToAll(ev);
      if (!aborted)
        res.cork(() => res.writeStatus("302 Found").writeHeader("Location", "/admin").end());
    });
  })
  .get("/admin/ban", (res, req) => {
    if (!adminOk(req)) return denyAdmin(res);
    const id = Number(req.getQuery("id"));
    let aborted = false;
    res.onAborted(() => {
      aborted = true;
    });
    notesMgr.banByNote(id, "admin ban").then(() => {
      const ev: EventMsg = { type: "event", kind: "note_removed", payload: { id } };
      sendToAll(ev);
      if (!aborted)
        res.cork(() => res.writeStatus("302 Found").writeHeader("Location", "/admin").end());
    });
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
