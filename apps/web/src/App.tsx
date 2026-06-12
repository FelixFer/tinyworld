import { useEffect, useRef, useState } from "react";
import { initGame } from "./game/Game.js";

type ConnStatus = "connecting" | "connected" | "disconnected";

// Module-level guard to prevent React StrictMode double-mount from creating duplicate games
let gameInitialized = false;

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    if (gameInitialized) return;
    gameInitialized = true;

    const el = containerRef.current;
    if (!el) return;

    let cleanup: (() => void) | undefined;
    (async () => {
      const game = await initGame(el, setPlayerCount);
      cleanup = () => {
        game.destroy();
      };
      setStatus("connected");
    })().catch(console.error);

    return () => {
      cleanup?.();
    };
  }, []);

  const label =
    status === "connected" && ping !== null
      ? `ping: ${ping} ms`
      : status === "connecting"
        ? "connecting…"
        : "disconnected";

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
    </div>
  );
}
