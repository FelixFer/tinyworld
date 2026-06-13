import type { EmoteKind } from "@tinyworld/shared";
import { EXHIBITS } from "@tinyworld/world";
import { useEffect, useRef, useState } from "react";
import { type GameInstance, initGame } from "./game/Game.js";
import { EmoteBar } from "./ui/EmoteBar.js";
import { ExhibitModal } from "./ui/ExhibitModal.js";
import { Joystick } from "./ui/Joystick.js";

const EMOTE_KEYS: EmoteKind[] = ["wave", "heart", "question", "bang"];

type ConnStatus = "connecting" | "connected" | "disconnected";

// Module-level guard to prevent React StrictMode double-mount from creating duplicate games
let gameInitialized = false;

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [playerCount, setPlayerCount] = useState(0);
  const [goals, setGoals] = useState(0);
  const [nearExhibitId, setNearExhibitId] = useState<string | null>(null);
  const [openExhibitId, setOpenExhibitId] = useState<string | null>(null);

  // Keep the latest nearby-exhibit id readable from the keydown handler
  // without re-binding the listener on every change.
  const nearRef = useRef<string | null>(null);
  nearRef.current = nearExhibitId;

  const gameRef = useRef<GameInstance | null>(null);
  const [isTouch] = useState(
    () => window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window,
  );

  useEffect(() => {
    if (gameInitialized) return;
    gameInitialized = true;

    const el = containerRef.current;
    if (!el) return;

    let cleanup: (() => void) | undefined;
    (async () => {
      const game = await initGame(el, {
        onPlayerCount: setPlayerCount,
        onNearExhibit: setNearExhibitId,
        onPing: setPing,
        onStatus: setStatus,
        onGoals: setGoals,
      });
      gameRef.current = game;
      cleanup = () => {
        gameRef.current = null;
        game.destroy();
      };
    })().catch(console.error);

    return () => {
      cleanup?.();
    };
  }, []);

  // E opens the nearby exhibit; Escape closes any open one.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E") {
        if (nearRef.current) setOpenExhibitId((cur) => cur ?? nearRef.current);
      } else if (e.key === "Escape") {
        setOpenExhibitId(null);
      } else if (e.key >= "1" && e.key <= "4") {
        gameRef.current?.sendEmote(EMOTE_KEYS[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label =
    status === "disconnected" ? "disconnected" : ping !== null ? `ping: ${ping} ms` : "connecting…";

  const openExhibit = openExhibitId ? EXHIBITS.find((e) => e.id === openExhibitId) : undefined;
  const nearExhibit = nearExhibitId ? EXHIBITS.find((e) => e.id === nearExhibitId) : undefined;
  const showPrompt = nearExhibit && !openExhibit;

  return (
    <div style={{ position: "relative", width: "100dvw", height: "100dvh" }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          color: "#a8e6cf",
          fontFamily: "monospace",
          fontSize: 14,
          background: "rgba(0,0,0,0.55)",
          padding: "4px 10px",
          borderRadius: 4,
          pointerEvents: "none",
        }}
      >
        {label}
        {playerCount > 0 && ` · ${playerCount} here`}
        {` · ⚽ ${goals}`}
      </div>

      {showPrompt && (
        <button
          type="button"
          onClick={() => setOpenExhibitId(nearExhibit.id)}
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "#ffffff",
            border: "1px solid #4ecdc4",
            borderRadius: 8,
            padding: "10px 16px",
            fontFamily: "system-ui, sans-serif",
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          {isTouch ? (
            `Tap to view ${nearExhibit.label}`
          ) : (
            <>
              Press <strong>E</strong> to view {nearExhibit.label}
            </>
          )}
        </button>
      )}

      {isTouch && !openExhibit && (
        <Joystick onMove={(dx, dy) => gameRef.current?.setJoystick(dx, dy)} />
      )}

      {!openExhibit && (
        <EmoteBar onEmote={(k) => gameRef.current?.sendEmote(k)} showKeys={!isTouch} />
      )}

      {openExhibit && (
        <ExhibitModal
          exhibit={openExhibit}
          playerCount={playerCount}
          onClose={() => setOpenExhibitId(null)}
        />
      )}
    </div>
  );
}
