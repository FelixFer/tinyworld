import type { Snapshot } from "@tinyworld/shared";
import { entityToSnapshot } from "@tinyworld/shared";
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

    const snapshot: Snapshot = {
      tick: game.currentTick,
      entities: Array.from(game.entities.values()).map(entityToSnapshot),
    };

    this.lastSnapshot = snapshot;

    return { snapshot, isKeyframe };
  }

  getLastSnapshot(): Snapshot | null {
    return this.lastSnapshot;
  }
}
