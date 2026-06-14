import type { EmoteKind } from "@tinyworld/shared";
import type { CSSProperties } from "react";

const EMOTES: { kind: EmoteKind; emoji: string; key: string }[] = [
  { kind: "wave", emoji: "👋", key: "1" },
  { kind: "heart", emoji: "❤️", key: "2" },
  { kind: "question", emoji: "❓", key: "3" },
  { kind: "bang", emoji: "❗", key: "4" },
];

interface EmoteBarProps {
  onEmote: (kind: EmoteKind) => void;
  /** Show the keyboard-shortcut hint (desktop only). */
  showKeys: boolean;
  /** Touch layout: a vertical column on the right edge, clear of the joystick. */
  vertical?: boolean;
}

export function EmoteBar({ onEmote, showKeys, vertical = false }: EmoteBarProps) {
  const position: CSSProperties = vertical
    ? {
        top: "50%",
        right: "calc(12px + env(safe-area-inset-right))",
        transform: "translateY(-50%)",
        flexDirection: "column",
      }
    : {
        bottom: "calc(32px + env(safe-area-inset-bottom))",
        right: "calc(32px + env(safe-area-inset-right))",
      };
  return (
    <div style={{ position: "absolute", display: "flex", gap: 8, ...position }}>
      {EMOTES.map((e) => (
        <button
          key={e.kind}
          type="button"
          onClick={() => onEmote(e.kind)}
          aria-label={`Emote: ${e.kind}`}
          title={showKeys ? `${e.kind} (key ${e.key})` : e.kind}
          style={{
            width: 44,
            height: 44,
            fontSize: 20,
            lineHeight: 1,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          {e.emoji}
        </button>
      ))}
    </div>
  );
}
