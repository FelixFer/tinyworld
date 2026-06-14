# k6 load test

Drives concurrent WebSocket visitors against the game server and lets you read
the headline numbers off the server's `/metrics` endpoint.

## Run

Install [k6](https://k6.io/docs/get-started/installation/) (`winget install k6` /
`brew install k6`), start the server, then:

```sh
# quick smoke run (validate the script)
MAX_VUS=20 HOLD=30s k6 run infra/k6/load.js

# the headline run: 200 concurrent visitors, held 2 min
k6 run infra/k6/load.js

# against a deployed box
WS_URL=wss://tinyworldweb-production.up.railway.app/ws k6 run infra/k6/load.js
```

Env knobs: `WS_URL`, `MAX_VUS` (default 200), `HOLD` (default `2m`),
`SESSION_MS` (per-connection lifetime before reconnect, default 20000).

## Reading the numbers (from `/metrics`, not k6)

Snapshots are binary frames, so per-frame sizing in k6 is awkward — the
authoritative numbers come from the server's Prometheus counters, which work
identically for the JSON and binary paths.

**p95 / p99 tick duration** — read directly (5-min sliding window):

```sh
curl -s localhost:3000/metrics | grep tinyworld_tick_duration_summary_ms
# tinyworld_tick_duration_summary_ms{quantile="0.95"} ...
# tinyworld_tick_duration_summary_ms{quantile="0.99"} ...
```

Target: **p95 < 10 ms, p99 < 16 ms** at 200 CCU (PLAN §12).

**Egress KB/s/client** — sample the byte counter before and after the steady
state, then divide by elapsed seconds and CCU:

```
bytesPerSecPerClient = (snap_bytes_after - snap_bytes_before)
                       / (elapsedSeconds * ccu)
```

```sh
curl -s localhost:3000/metrics | grep -E 'tinyworld_snap_bytes_total|tinyworld_ccu'
```

Target: **< 12 KB/s/client (JSON v0) → < 4 KB/s (binary v1)** (PLAN §12).

## Before/after: JSON vs binary

Run the test twice against the same build, toggling the server env:

```sh
SNAP_BINARY=false node apps/server/dist/index.js   # JSON baseline
SNAP_BINARY=true  node apps/server/dist/index.js   # binary (default)
```

Capture `bytesPerSecPerClient` each time → that delta is the binary protocol's
bandwidth win, and the headline of the perf writeup.

## Caveat

200 VUs and the server sharing one machine compete for CPU, which inflates tick
p95. For *publishable* numbers, run k6 against the deployed Railway box (set
`WS_URL`) or from a separate machine. A local run validates the harness and
gives a ballpark.
