// tinyworld load test — drives N concurrent WebSocket clients that each behave
// like a real visitor: join (hello), walk (~30 inputs/s), ping every 2s, read
// snapshots, then disconnect and reconnect. This generates the input -> 20Hz
// tick -> snapshot egress path under load.
//
// The headline numbers (p95 tick duration, egress KB/s/client) are read from
// the server's own /metrics endpoint, NOT from k6 — see infra/k6/README.md.
//
//   k6 run infra/k6/load.js                       # 200 VUs (the headline run)
//   MAX_VUS=20 HOLD=30s k6 run infra/k6/load.js    # quick smoke run
//   WS_URL=wss://host/ws k6 run infra/k6/load.js   # against a deployed box

import { check } from "k6";
import { Counter } from "k6/metrics";
import ws from "k6/ws";

const WS_URL = __ENV.WS_URL || "ws://localhost:3000/ws";
const MAX_VUS = Number(__ENV.MAX_VUS || 200);
const HOLD = __ENV.HOLD || "2m";
const SESSION_MS = Number(__ENV.SESSION_MS || 20000);

export const options = {
  stages: [
    { duration: "30s", target: MAX_VUS },
    { duration: HOLD, target: MAX_VUS },
    { duration: "15s", target: 0 },
  ],
};

const framesReceived = new Counter("ws_frames_received");

// A repeating walk so the server actually steps movement every input.
const WALK = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 0 },
];

export default function () {
  const res = ws.connect(WS_URL, {}, (socket) => {
    let seq = 0;

    socket.on("open", () => {
      socket.send(JSON.stringify({ type: "hello" }));

      // ~30 inputs/s (server caps at 40/s).
      socket.setInterval(() => {
        seq++;
        const d = WALK[seq % WALK.length];
        socket.send(JSON.stringify({ type: "input", seq, dt: 1 / 30, dx: d.dx, dy: d.dy }));
      }, 33);

      // Clock-sync ping every 2s.
      socket.setInterval(() => {
        socket.send(JSON.stringify({ type: "ping", t: Date.now() }));
      }, 2000);

      // Hold the session, then close so the VU reconnects (keeps CCU at target).
      socket.setTimeout(() => socket.close(), SESSION_MS);
    });

    // JSON frames (welcome/pong/event) and binary frames (snapshots).
    socket.on("message", () => framesReceived.add(1));
    socket.on("binaryMessage", () => framesReceived.add(1));
    socket.on("error", () => {});
  });

  check(res, { "ws handshake is 101": (r) => r && r.status === 101 });
}
