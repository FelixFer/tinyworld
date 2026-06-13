export interface GhostSample {
  x: number;
  y: number;
}

/**
 * Encode a path as: uint16 startX, uint16 startY, then int8 dx, dy per sample.
 * At 4 Hz / 96 px/s, deltas stay within int8 range. ~2 bytes/sample. base64.
 */
export function encodeGhostPath(samples: GhostSample[]): string {
  if (samples.length === 0) return "";
  const bytes: number[] = [];
  let px = Math.round(samples[0].x);
  let py = Math.round(samples[0].y);
  bytes.push((px >> 8) & 0xff, px & 0xff, (py >> 8) & 0xff, py & 0xff);
  for (let i = 1; i < samples.length; i++) {
    const dx = Math.max(-127, Math.min(127, Math.round(samples[i].x) - px));
    const dy = Math.max(-127, Math.min(127, Math.round(samples[i].y) - py));
    bytes.push(dx & 0xff, dy & 0xff);
    px += dx;
    py += dy;
  }
  return Buffer.from(bytes).toString("base64");
}

export function decodeGhostPath(encoded: string): GhostSample[] {
  if (!encoded) return [];
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 4) return [];
  let x = (bytes[0] << 8) | bytes[1];
  let y = (bytes[2] << 8) | bytes[3];
  const out: GhostSample[] = [{ x, y }];
  for (let i = 4; i + 1 < bytes.length; i += 2) {
    x += (bytes[i] << 24) >> 24; // int8 sign-extend
    y += (bytes[i + 1] << 24) >> 24;
    out.push({ x, y });
  }
  return out;
}
