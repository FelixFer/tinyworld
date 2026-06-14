import type { Dir, EntityInput, SolidTest, Steppable } from "@tinyworld/shared";
import { GOAL_RECT, createEntity, step } from "@tinyworld/shared";
import { CollisionGrid, VILLAGE_MAP } from "@tinyworld/world";
import { observeTick } from "../metrics.js";
import { Ball } from "./Ball.js";
import { Cat } from "./Cat.js";
import { saveCounter } from "./Counters.js";
import { Dog } from "./Dog.js";
import { GhostManager } from "./Ghosts.js";
import type { GhostSample } from "./ghostCodec.js";

type GhostRecord = { samples: GhostSample[]; durationS: number };

const collision = new CollisionGrid(VILLAGE_MAP);
const isSolid: SolidTest = (rect) => collision.testRect(rect);

const KICK_RANGE = 14; // px between player center and ball center to kick
const KICK_SPEED = 175; // px/s imparted on a kick

export class ServerEntity implements Steppable {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  lastInputSeq: number;
  token: string;
  disconnectedAt = 0;
  private pendingInputs: EntityInput[] = [];

  constructor(id: string, x: number, y: number, name: string, token: string) {
    const entity = createEntity(id, x, y, name);
    this.id = entity.id;
    this.x = entity.x;
    this.y = entity.y;
    this.dir = entity.dir;
    this.name = entity.name;
    this.lastInputSeq = entity.lastInputSeq;
    this.token = token;
  }

  queueInput(input: EntityInput): void {
    this.pendingInputs.push(input);
  }

  getPendingInputs(): EntityInput[] {
    const inputs = this.pendingInputs;
    this.pendingInputs = [];
    return inputs;
  }

  // --- ghost recording ---
  readonly joinedAtMs = Date.now();
  private samples: GhostSample[] = [];
  private pathDist = 0;

  recordSample(): void {
    const last = this.samples[this.samples.length - 1];
    if (last) this.pathDist += Math.hypot(this.x - last.x, this.y - last.y);
    if (this.samples.length < 3000) this.samples.push({ x: this.x, y: this.y });
  }

  /** Recorded path if the session qualifies as a ghost (≥60s, moved ≥30 tiles), else null. */
  finishGhost(): GhostRecord | null {
    const durationS = Math.round((Date.now() - this.joinedAtMs) / 1000);
    if (durationS < 60 || this.pathDist < 30 * 16 || this.samples.length < 8) return null;
    return { samples: this.samples, durationS };
  }
}

export class ServerGame {
  readonly entities = new Map<string, ServerEntity>();
  readonly cat = new Cat(20 * 16, 8 * 16);
  readonly dog = new Dog(10 * 16, 4 * 16);
  readonly ball = new Ball();
  readonly ghosts = new GhostManager();
  goals = 0;
  currentTick = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly tickRate = 20;
  private readonly tickDuration = 1 / 20;

  start(): void {
    this.tickInterval = setInterval(() => this.gameTick(), 1000 / this.tickRate);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private gameTick(): void {
    const t0 = performance.now();
    this.currentTick++;

    for (const serverEntity of this.entities.values()) {
      const inputs = serverEntity.getPendingInputs();

      // Process each input through the same step() the client predicted with,
      // in order, so the authoritative position matches the client's prediction
      // and lastInputSeq advances per input for reconciliation.
      for (const input of inputs) {
        step(serverEntity, { dx: input.dx, dy: input.dy, dt: input.dt }, isSolid);
        serverEntity.lastInputSeq = input.seq;
      }
    }

    // Players kick the ball by walking into it.
    for (const p of this.entities.values()) {
      if (p.disconnectedAt > 0) continue;
      const dx = this.ball.x - (p.x + 8);
      const dy = this.ball.y - (p.y + 8);
      if (Math.hypot(dx, dy) < KICK_RANGE) this.ball.kick(dx, dy, KICK_SPEED);
    }
    this.ball.update(this.tickDuration, isSolid);
    if (this.ballInGoal()) {
      this.goals++;
      this.ball.reset();
      saveCounter("goals", this.goals).catch((e) => console.error("goals persist failed", e));
    }

    this.cat.update(this.tickDuration, isSolid);
    this.dog.update(this.tickDuration, isSolid);
    this.ghosts.advance(this.tickDuration);

    // Record live players' paths at 4 Hz for future ghost replay.
    if (this.currentTick % 5 === 0) {
      for (const e of this.entities.values()) {
        if (e.disconnectedAt === 0) e.recordSample();
      }
    }

    observeTick(performance.now() - t0);
  }

  private ballInGoal(): boolean {
    const b = this.ball;
    return (
      b.x >= GOAL_RECT.x &&
      b.x <= GOAL_RECT.x + GOAL_RECT.width &&
      b.y >= GOAL_RECT.y &&
      b.y <= GOAL_RECT.y + GOAL_RECT.height
    );
  }

  addEntity(id: string, x: number, y: number, name: string, token: string): ServerEntity {
    const entity = new ServerEntity(id, x, y, name, token);
    this.entities.set(id, entity);
    return entity;
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
  }

  findEntityByToken(token: string): ServerEntity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.token === token) return entity;
    }
    return undefined;
  }

  reconnectEntity(entity: ServerEntity, newId: string): void {
    this.entities.delete(entity.id);
    entity.id = newId;
    entity.disconnectedAt = 0;
    this.entities.set(newId, entity);
  }

  markDisconnected(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.disconnectedAt = Date.now();
    }
  }

  /** Removes entities past their grace window; returns ghost-worthy recorded paths. */
  cleanupDisconnected(graceMs: number): GhostRecord[] {
    const now = Date.now();
    const finished: GhostRecord[] = [];
    for (const [id, entity] of this.entities) {
      if (entity.disconnectedAt > 0 && now - entity.disconnectedAt >= graceMs) {
        const ghost = entity.finishGhost();
        if (ghost) finished.push(ghost);
        this.entities.delete(id);
      }
    }
    return finished;
  }

  getEntity(id: string): ServerEntity | undefined {
    return this.entities.get(id);
  }
}
