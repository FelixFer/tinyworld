import type { EmoteKind, Note } from "@tinyworld/shared";
import { EXHIBITS } from "@tinyworld/world";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { type GameInstance, initGame } from "./game/Game.js";
import { EmoteBar } from "./ui/EmoteBar.js";
import { ExhibitModal } from "./ui/ExhibitModal.js";
import { Joystick } from "./ui/Joystick.js";

const EMOTE_KEYS: EmoteKind[] = ["wave", "heart", "question", "bang"];

const composerBtn: CSSProperties = {
  background: "transparent",
  color: "#e8e8f0",
  border: "1px solid #44445f",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 14,
  cursor: "pointer",
};

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
  const [composerOpen, setComposerOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [reportNote, setReportNote] = useState<Note | null>(null);

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
        onReportNote: (note) => setReportNote(note),
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

  // Keyboard: E exhibit, N note, 1-4 emote, Escape closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenExhibitId(null);
        setComposerOpen(false);
        setReportNote(null);
        return;
      }
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return; // user is typing
      if (e.key === "e" || e.key === "E") {
        if (nearRef.current) setOpenExhibitId((cur) => cur ?? nearRef.current);
      } else if (e.key === "n" || e.key === "N") {
        setComposerOpen(true);
      } else if (e.key >= "1" && e.key <= "4") {
        gameRef.current?.sendEmote(EMOTE_KEYS[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitNote = () => {
    const t = noteText.trim();
    if (t) gameRef.current?.sendNote(t);
    setNoteText("");
    setComposerOpen(false);
  };

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

      {!openExhibit && !composerOpen && !showPrompt && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.6)",
            color: "#fff3c4",
            border: "1px solid #fff3c4",
            borderRadius: 8,
            padding: "8px 14px",
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ✎ leave a note{!isTouch && " (N)"}
        </button>
      )}

      {composerOpen && (
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "rgba(0,0,0,0.82)",
            padding: 10,
            borderRadius: 10,
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: opening the composer should focus it immediately
            autoFocus
            maxLength={140}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNote();
            }}
            placeholder="chalk a note (140 max)…"
            style={{
              width: "min(260px, 60vw)",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #4ecdc4",
              background: "#1a1a2e",
              color: "#fff",
              fontSize: 14,
            }}
          />
          <button type="button" onClick={submitNote} style={composerBtn}>
            Leave
          </button>
          <button
            type="button"
            onClick={() => {
              setComposerOpen(false);
              setNoteText("");
            }}
            style={composerBtn}
          >
            ✕
          </button>
        </div>
      )}

      {reportNote && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes this; backdrop click is a convenience.
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportNote(null);
          }}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#22223b",
              color: "#e8e8f0",
              borderRadius: 10,
              padding: 20,
              maxWidth: 320,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <p style={{ margin: "0 0 8px" }}>Report this note?</p>
            <p style={{ margin: "0 0 16px", opacity: 0.7, fontStyle: "italic" }}>
              “{reportNote.text}”
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setReportNote(null)} style={composerBtn}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  gameRef.current?.sendReport(reportNote.id);
                  setReportNote(null);
                }}
                style={{ ...composerBtn, borderColor: "#ff6b9d", color: "#ff6b9d" }}
              >
                Report
              </button>
            </div>
          </div>
        </div>
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
