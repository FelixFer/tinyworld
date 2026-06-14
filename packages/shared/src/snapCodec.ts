// Binary protocol v1 — encode/decode the snapshot hot path (SnapMsg).
//
// Only the periodic SnapMsg (server → client, 20 Hz) travels as a binary frame;
// it is ~all of the egress, so this is where the bandwidth win lives. Every
// other message stays JSON. Layout (little-endian DataView):
//
//   u8  msgType (SNAP_MSG_TYPE)
//   u32 tick
//   i32 baseTick            (-1 => keyframe / undefined)
//   u16 playerCount
//   u16 timeOfDay           (round(t * 65535); /65535 on decode)
//   u32 goals
//   u16 entityCount
//   per entity:
//     u8  kind              (KIND_ORDER index)
//     u8  dir               (DIR_ORDER index)
//     i16 x                 (round(x * 8) => 1/8-px fixed point)
//     i16 y                 (round(y * 8))
//     u32 lastInputSeq
//     u8 len + bytes  id    (UTF-8)
//     u8 len + bytes  name  (UTF-8; empty for non-players)

import {
  DIR_ORDER,
  DIR_TO_INT,
  type EntitySnapshot,
  KIND_ORDER,
  KIND_TO_INT,
  SNAP_MSG_TYPE,
  type SnapMsg,
} from "./protocol.js";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/** Fixed-point scale for positions: 1/8-px precision, int16 range ±4095 px. */
const POS_SCALE = 8;

class ByteWriter {
  private buf: Uint8Array;
  private view: DataView;
  private pos = 0;

  constructor(initial = 2048) {
    this.buf = new Uint8Array(initial);
    this.view = new DataView(this.buf.buffer);
  }

  private ensure(n: number): void {
    if (this.pos + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.pos + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf);
    this.buf = next;
    this.view = new DataView(this.buf.buffer);
  }

  u8(v: number): void {
    this.ensure(1);
    this.view.setUint8(this.pos, v);
    this.pos += 1;
  }
  u16(v: number): void {
    this.ensure(2);
    this.view.setUint16(this.pos, v, true);
    this.pos += 2;
  }
  i16(v: number): void {
    this.ensure(2);
    this.view.setInt16(this.pos, v, true);
    this.pos += 2;
  }
  u32(v: number): void {
    this.ensure(4);
    this.view.setUint32(this.pos, v, true);
    this.pos += 4;
  }
  i32(v: number): void {
    this.ensure(4);
    this.view.setInt32(this.pos, v, true);
    this.pos += 4;
  }
  /** Length-prefixed (u8) UTF-8 string, clamped to 255 bytes. */
  str(s: string): void {
    const bytes = TEXT_ENCODER.encode(s);
    const n = Math.min(bytes.length, 255);
    this.u8(n);
    this.ensure(n);
    this.buf.set(bytes.subarray(0, n), this.pos);
    this.pos += n;
  }

  /** Exactly-sized copy (byteOffset 0, no trailing padding) so the wire frame
   * is the true byte count regardless of how the socket reads the view. */
  result(): Uint8Array {
    return this.buf.slice(0, this.pos);
  }
}

class ByteReader {
  private view: DataView;
  private bytes: Uint8Array;
  private pos = 0;

  constructor(u8: Uint8Array) {
    this.bytes = u8;
    this.view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  }

  u8(): number {
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }
  u16(): number {
    const v = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }
  i16(): number {
    const v = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return v;
  }
  u32(): number {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }
  i32(): number {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }
  str(): string {
    const len = this.u8();
    const s = TEXT_DECODER.decode(this.bytes.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }
}

export function encodeSnap(msg: SnapMsg): Uint8Array {
  const w = new ByteWriter();
  w.u8(SNAP_MSG_TYPE);
  w.u32(msg.tick);
  w.i32(msg.baseTick ?? -1);
  w.u16(msg.playerCount);
  w.u16(Math.round(msg.timeOfDay * 65535));
  w.u32(msg.goals);
  w.u16(msg.entities.length);
  for (const e of msg.entities) {
    w.u8(KIND_TO_INT[e.kind]);
    w.u8(DIR_TO_INT[e.dir]);
    w.i16(Math.round(e.x * POS_SCALE));
    w.i16(Math.round(e.y * POS_SCALE));
    w.u32(e.lastInputSeq);
    w.str(e.id);
    w.str(e.name);
  }
  return w.result();
}

export function decodeSnap(input: ArrayBuffer | Uint8Array): SnapMsg {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const r = new ByteReader(u8);
  r.u8(); // msgType (already routed on)
  const tick = r.u32();
  const baseTickRaw = r.i32();
  const playerCount = r.u16();
  const timeOfDay = r.u16() / 65535;
  const goals = r.u32();
  const count = r.u16();
  const entities: EntitySnapshot[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const kind = KIND_ORDER[r.u8()];
    const dir = DIR_ORDER[r.u8()];
    const x = r.i16() / POS_SCALE;
    const y = r.i16() / POS_SCALE;
    const lastInputSeq = r.u32();
    const id = r.str();
    const name = r.str();
    entities[i] = { id, x, y, dir, name, lastInputSeq, kind };
  }
  const msg: SnapMsg = {
    type: "snap",
    tick,
    entities,
    playerCount,
    timeOfDay,
    goals,
  };
  if (baseTickRaw >= 0) msg.baseTick = baseTickRaw;
  return msg;
}
