import type { Dir, EntityInput, SolidTest, Steppable } from "@tinyworld/shared";
import { createEntity, step } from "@tinyworld/shared";
import { CollisionGrid, VILLAGE_MAP } from "@tinyworld/world";

const collision = new CollisionGrid(VILLAGE_MAP);
const isSolid: SolidTest = (rect) => collision.testRect(rect);

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
}

export class ServerGame {
  readonly entities = new Map<string, ServerEntity>();
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

  cleanupDisconnected(graceMs: number): void {
    const now = Date.now();
    for (const [id, entity] of this.entities) {
      if (entity.disconnectedAt > 0 && now - entity.disconnectedAt >= graceMs) {
        this.entities.delete(id);
      }
    }
  }

  getEntity(id: string): ServerEntity | undefined {
    return this.entities.get(id);
  }
}
