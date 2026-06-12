import { EXHIBITS } from "@tinyworld/world";
import { useEffect, useRef, useState } from "react";
import { initGame } from "./game/Game.js";
import { ExhibitModal } from "./ui/ExhibitModal.js";

type ConnStatus = "connecting" | "connected" | "disconnected";

// Module-level guard to prevent React StrictMode double-mount from creating duplicate games
let gameInitialized = false;

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [playerCount, setPlayerCount] = useState(0);
  const [nearExhibitId, setNearExhibitId] = useState<string | null>(null);
  const [openExhibitId, setOpenExhibitId] = useState<string | null>(null);

  // Keep the latest nearby-exhibit id readable from the keydown handler
  // without re-binding the listener on every change.
  const nearRef = useRef<string | null>(null);
  nearRef.current = nearExhibitId;

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
      });
      cleanup = () => {
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const label =
    status === "disconnected"
      ? "disconnected"
      : ping !== null
        ? `ping: ${ping} ms`
        : "connecting…";

  const openExhibit = openExhibitId ? EXHIBITS.find((e) => e.id === openExhibitId) : undefined;
  const nearExhibit = nearExhibitId ? EXHIBITS.find((e) => e.id === nearExhibitId) : undefined;
  const showPrompt = nearExhibit && !openExhibit;

  return (
    <div style={{ position: "relative", width: "100dvw", height: "100dvh" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
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
          Press <strong>E</strong> to view {nearExhibit.label}
        </button>
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
