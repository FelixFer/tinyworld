// Prometheus metrics — the measurement substrate for M5 ("numbers or it didn't
// happen"). One registry, scraped at GET /metrics. Tick duration is recorded
// into both a Histogram (for Grafana quantiles) and a Summary (for an instant
// p50/p95/p99 readout in the load-test writeup, no Prometheus required).

import { Counter, Gauge, Histogram, Registry, Summary, collectDefaultMetrics } from "prom-client";

export const register = new Registry();
register.setDefaultLabels({ app: "tinyworld" });
collectDefaultMetrics({ register });

const tickHistogram = new Histogram({
  name: "tinyworld_tick_duration_ms",
  help: "Server game-tick duration in milliseconds",
  buckets: [0.5, 1, 2, 4, 6, 8, 10, 12, 16, 20, 30],
  registers: [register],
});

const tickSummary = new Summary({
  name: "tinyworld_tick_duration_summary_ms",
  help: "Server game-tick duration percentiles (ms)",
  percentiles: [0.5, 0.95, 0.99],
  maxAgeSeconds: 300,
  ageBuckets: 5,
  registers: [register],
});

export const ccu = new Gauge({
  name: "tinyworld_ccu",
  help: "Connected players (concurrent users)",
  registers: [register],
});

export const entitiesGauge = new Gauge({
  name: "tinyworld_entities",
  help: "Total simulated entities, including disconnected-in-grace",
  registers: [register],
});

export const snapBytes = new Counter({
  name: "tinyworld_snap_bytes_total",
  help: "Total snapshot bytes sent to clients (summed per recipient)",
  registers: [register],
});

export const snapMsgs = new Counter({
  name: "tinyworld_snap_messages_total",
  help: "Total snapshot messages sent to clients (summed per recipient)",
  registers: [register],
});

/** Record one tick's duration (ms) into both the histogram and the summary. */
export function observeTick(ms: number): void {
  tickHistogram.observe(ms);
  tickSummary.observe(ms);
}
