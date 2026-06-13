import type {
  ClientMsg,
  Dir,
  EmoteKind,
  EventMsg,
  InputMsg,
  Note,
  NotesMsg,
  PingMsg,
  PongMsg,
  ServerMsg,
  SnapMsg,
  WelcomeMsg,
} from "@tinyworld/shared";

const WS_URL = import.meta.env.DEV
  ? "ws://localhost:3000/ws"
  : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export interface SocketHandle {
  close: () => void;
  sendInput: (seq: number, dt: number, dx: number, dy: number) => void;
  sendHello: (name?: string, token?: string) => void;
  sendEmote: (kind: EmoteKind) => void;
  sendNote: (text: string) => void;
  sendReport: (noteId: number) => void;
}

interface SocketOptions {
  onPing: (ms: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onWelcome: (msg: WelcomeMsg) => void;
  onSnap: (msg: SnapMsg) => void;
  onEvent: (msg: EventMsg) => void;
  onNotes: (notes: Note[]) => void;
}

export function createSocket(opts: SocketOptions): SocketHandle {
  const ws = new WebSocket(WS_URL);
  let pingInterval: ReturnType<typeof setInterval> | undefined;

  ws.addEventListener("open", () => {
    opts.onOpen();
    pingInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const msg: PingMsg = { type: "ping", t: Date.now() };
      ws.send(JSON.stringify(msg));
    }, 2000);
  });

  ws.addEventListener("message", (event) => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(event.data as string) as ServerMsg;
    } catch {
      return;
    }

    switch (msg.type) {
      case "pong": {
        const pong = msg as PongMsg;
        opts.onPing(Date.now() - pong.t);
        break;
      }
      case "welcome": {
        opts.onWelcome(msg as WelcomeMsg);
        break;
      }
      case "snap": {
        opts.onSnap(msg as SnapMsg);
        break;
      }
      case "event": {
        opts.onEvent(msg as EventMsg);
        break;
      }
      case "notes": {
        opts.onNotes((msg as NotesMsg).notes);
        break;
      }
    }
  });

  ws.addEventListener("close", () => {
    if (pingInterval) clearInterval(pingInterval);
    opts.onClose();
  });

  return {
    close: () => {
      if (pingInterval) clearInterval(pingInterval);
      ws.close();
    },
    sendInput: (seq: number, dt: number, dx: number, dy: number) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const msg: InputMsg = { type: "input", seq, dt, dx, dy };
      ws.send(JSON.stringify(msg));
    },
    sendHello: (name?: string, token?: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const msg: ClientMsg = { type: "hello", name, token };
      ws.send(JSON.stringify(msg));
    },
    sendEmote: (kind: EmoteKind) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const msg: ClientMsg = { type: "emote", kind };
      ws.send(JSON.stringify(msg));
    },
    sendNote: (text: string) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      // Server places the note at the player's authoritative position; x/y unused.
      const msg: ClientMsg = { type: "note", text, x: 0, y: 0 };
      ws.send(JSON.stringify(msg));
    },
    sendReport: (noteId: number) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const msg: ClientMsg = { type: "report", noteId };
      ws.send(JSON.stringify(msg));
    },
  };
}
