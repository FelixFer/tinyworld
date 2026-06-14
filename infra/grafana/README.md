# Grafana + Prometheus (local)

A reproducible local dashboard for the server's `/metrics` — no cloud account.
Prometheus scrapes the running game server; Grafana renders it, with the
`tinyworld` dashboard and datasource auto-provisioned.

## Run

```sh
# 1. start the game server on :3000
node apps/server/dist/index.js        # or: pnpm --filter @tinyworld/server dev

# 2. start the observability stack
docker compose -f infra/docker-compose.yml up -d

# 3. generate some load (optional but that's the fun part)
k6 run infra/k6/load.js
```

Open **http://localhost:3001** (admin / admin) → dashboard **tinyworld**.
Prometheus UI is at http://localhost:9090.

## Panels

- **CCU** — `tinyworld_ccu`
- **Tick duration p95 / p99** — `histogram_quantile` over `tinyworld_tick_duration_ms_bucket` (target: p95 < 10 ms @ 200 CCU)
- **Snapshot egress per client** — `rate(tinyworld_snap_bytes_total[1m]) / ccu`
- **Snapshots/s per client** — should sit at ~20
- **Entities vs CCU**, **Process CPU**, **Process RSS**

## Scrape the deployed box instead

Edit `infra/prometheus/prometheus.yml` — comment out the `tinyworld` job and
uncomment `tinyworld-prod` (HTTPS scrape of the Railway host), then
`docker compose -f infra/docker-compose.yml restart prometheus`.

## Teardown

```sh
docker compose -f infra/docker-compose.yml down
```
