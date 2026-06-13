import type { Note } from "@tinyworld/shared";
import { Container, Text, TextStyle } from "pixi.js";

const FADE_MS = 7 * 86_400_000; // notes fade out over 7 days

interface Rendered {
  note: Note;
  container: Container;
}

/** Renders chalk notes on the map, fading by age, each tappable to report. */
export class NotesLayer {
  readonly container: Container;
  private readonly byId = new Map<number, Rendered>();
  private readonly onReport: (note: Note) => void;

  constructor(onReport: (note: Note) => void) {
    this.container = new Container();
    this.onReport = onReport;
  }

  setNotes(notes: Note[]): void {
    for (const r of this.byId.values()) r.container.destroy();
    this.byId.clear();
    for (const n of notes) this.add(n);
  }

  add(note: Note): void {
    if (this.byId.has(note.id)) return;
    const c = new Container();
    c.x = Math.round(note.x);
    c.y = Math.round(note.y);
    const label = new Text({
      text: note.text,
      style: new TextStyle({
        fontSize: 7,
        fill: "#fff3c4",
        stroke: { color: "#000000", width: 2 },
        align: "center",
        wordWrap: true,
        wordWrapWidth: 90,
      }),
    });
    label.anchor.set(0.5, 1);
    label.eventMode = "static";
    label.cursor = "pointer";
    label.on("pointertap", () => this.onReport(note));
    c.addChild(label);
    this.container.addChild(c);
    this.byId.set(note.id, { note, container: c });
  }

  remove(id: number): void {
    const r = this.byId.get(id);
    if (r) {
      r.container.destroy();
      this.byId.delete(id);
    }
  }

  update(): void {
    const now = Date.now();
    for (const r of this.byId.values()) {
      r.container.alpha = Math.max(0.12, 1 - (now - r.note.createdAt) / FADE_MS);
    }
  }
}
