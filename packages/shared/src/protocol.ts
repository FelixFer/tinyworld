export type Dir = "up" | "down" | "left" | "right" | "idle";

export interface HelloMsg {
  type: "hello";
  name?: string;
  token?: string;
}
export interface InputMsg {
  type: "input";
  seq: number;
  dt: number;
  dx: number;
  dy: number;
}
export interface EmoteMsg {
  type: "emote";
  kind: "wave" | "heart" | "question" | "bang";
}
export interface KickMsg {
  type: "kick";
  dir: { x: number; y: number };
}
export interface NoteMsg {
  type: "note";
  text: string;
  x: number;
  y: number;
}
export interface PingMsg {
  type: "ping";
  t: number;
}

export type ClientMsg = HelloMsg | InputMsg | EmoteMsg | KickMsg | NoteMsg | PingMsg;

export interface WelcomeMsg {
  type: "welcome";
  selfId: string;
  token: string;
  mapVersion: number;
  snapshot: Snapshot;
}

export interface SnapMsg {
  type: "snap";
  tick: number;
  baseTick?: number;
  entities: EntitySnapshot[];
  playerCount: number;
  /** Time of day in [0,1): 0 = midnight, 0.5 = noon. Derived from the server clock. */
  timeOfDay: number;
}

/** Length of a full in-world day/night cycle, in ms. Shared so clients can interpolate between snapshots. */
export const DAY_CYCLE_MS = 600_000; // 10 minutes

export interface EventMsg {
  type: "event";
  kind: "join" | "leave" | "emote" | "note" | "goal";
  payload: unknown;
}

export interface PongMsg {
  type: "pong";
  t: number;
  serverTime: number;
}
export interface ErrorMsg {
  type: "error";
  code: "rate_limited" | "banned" | "full";
}

export type ServerMsg = WelcomeMsg | SnapMsg | EventMsg | PongMsg | ErrorMsg;

export interface EntitySnapshot {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  /** Last client input the server has processed for this entity (reconciliation ack). */
  lastInputSeq: number;
}

export interface Snapshot {
  tick: number;
  entities: EntitySnapshot[];
}

export function entityToSnapshot(entity: {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  lastInputSeq: number;
}): EntitySnapshot {
  return {
    id: entity.id,
    x: Math.round(entity.x * 100) / 100,
    y: Math.round(entity.y * 100) / 100,
    dir: entity.dir,
    name: entity.name,
    lastInputSeq: entity.lastInputSeq,
  };
}
