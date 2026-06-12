import type { EntitySnapshot, Snapshot } from "@tinyworld/shared";
import type { ServerGame } from "./Game.js";

const KEYFRAME_INTERVAL = 40;

export class SnapshotManager {
  private lastKeyframeTick = 0;
  private lastSnapshot: Snapshot | null = null;

  generateSnapshot(game: ServerGame): { snapshot: Snapshot; isKeyframe: boolean } {
    const isKeyframe = game.currentTick - this.lastKeyframeTick >= KEYFRAME_INTERVAL;
    if (isKeyframe) {
      this.lastKeyframeTick = game.currentTick;
    }

    const entities: EntitySnapshot[] = [];
    for (const serverEntity of game.entities.values()) {
      entities.push({
        id: serverEntity.id,
        x: Math.round(serverEntity.x * 100) / 100,
        y: Math.round(serverEntity.y * 100) / 100,
        dir: serverEntity.dir,
        name: serverEntity.name,
      });
    }

    const snapshot: Snapshot = {
      tick: game.currentTick,
      entities,
    };

    this.lastSnapshot = snapshot;

    return { snapshot, isKeyframe };
  }

  getLastSnapshot(): Snapshot | null {
    return this.lastSnapshot;
  }
}
