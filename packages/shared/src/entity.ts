import type { Dir } from "./protocol.js";

export interface Entity {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  lastInputSeq: number;
}

export interface EntityInput {
  entityId: string;
  seq: number;
  dt: number;
  dx: number;
  dy: number;
}

export interface Steppable {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  lastInputSeq: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Movement speed in pixels per second. */
export const SPEED = 96;

/** Avatar collision box: offset + size relative to the entity's top-left. */
export const HITBOX = { x: 3, y: 8, width: 10, height: 8 };

/** Returns true if the given rect overlaps a solid tile. */
export type SolidTest = (rect: Rect) => boolean;

export interface MoveInput {
  dx: number;
  dy: number;
  dt: number;
}

/**
 * Advance one entity by a single input, with axis-separated collision.
 *
 * This is THE movement simulation — the client calls it for prediction and the
 * server calls it for authority, so both agree on the result. Keep it pure:
 * it mutates only `state`, and all map knowledge arrives via `isSolid`.
 */
export function step(
  state: { x: number; y: number; dir: Dir },
  input: MoveInput,
  isSolid: SolidTest,
): void {
  // Facing follows the raw input — horizontal takes priority on a diagonal.
  if (input.dx !== 0) {
    state.dir = input.dx > 0 ? "right" : "left";
  } else if (input.dy !== 0) {
    state.dir = input.dy > 0 ? "down" : "up";
  }

  // Normalize diagonals so speed is constant in every direction.
  let dx = input.dx;
  let dy = input.dy;
  if (dx !== 0 && dy !== 0) {
    dx *= Math.SQRT1_2;
    dy *= Math.SQRT1_2;
  }

  const moveX = dx * SPEED * input.dt;
  const moveY = dy * SPEED * input.dt;

  if (moveX !== 0) {
    const newX = state.x + moveX;
    if (
      !isSolid({
        x: newX + HITBOX.x,
        y: state.y + HITBOX.y,
        width: HITBOX.width,
        height: HITBOX.height,
      })
    ) {
      state.x = newX;
    }
  }

  if (moveY !== 0) {
    const newY = state.y + moveY;
    if (
      !isSolid({
        x: state.x + HITBOX.x,
        y: newY + HITBOX.y,
        width: HITBOX.width,
        height: HITBOX.height,
      })
    ) {
      state.y = newY;
    }
  }
}

export function createEntity(id: string, x: number, y: number, name: string): Entity {
  return {
    id,
    x,
    y,
    dir: "down",
    name,
    lastInputSeq: 0,
  };
}
