import type { Exhibit } from "@tinyworld/world";
import { useEffect, useRef } from "react";

interface ExhibitModalProps {
  exhibit: Exhibit;
  playerCount: number;
  onClose: () => void;
}

export function ExhibitModal({ exhibit, playerCount, onClose }: ExhibitModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `exhibit-title-${exhibit.id}`;

  // Move focus into the dialog when it opens (accessibility).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const paragraphs = exhibit.body.split("\n\n");

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape-to-close is handled globally in App.
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#22223b",
          color: "#e8e8f0",
          width: "min(560px, 100%)",
          maxHeight: "80dvh",
          overflowY: "auto",
          borderRadius: 10,
          border: "1px solid #44445f",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          padding: "20px 22px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}
        >
          <h2 id={titleId} style={{ fontSize: 20, margin: 0, lineHeight: 1.25 }}>
            {exhibit.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              background: "transparent",
              color: "#e8e8f0",
              border: "1px solid #44445f",
              borderRadius: 6,
              width: 30,
              height: 30,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {paragraphs.map((p, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered.
          <p key={i} style={{ margin: "14px 0 0", lineHeight: 1.55, fontSize: 15 }}>
            {p}
          </p>
        ))}

        {exhibit.images && exhibit.images.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {exhibit.images.map((src) => (
              <img
                key={src}
                src={src}
                alt={`${exhibit.title} screenshot`}
                loading="lazy"
                style={{
                  height: 200,
                  width: "auto",
                  maxWidth: "100%",
                  borderRadius: 6,
                  border: "1px solid #44445f",
                  background: "#10101a",
                }}
              />
            ))}
          </div>
        )}

        {exhibit.tags && exhibit.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            {exhibit.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  background: "rgba(78,205,196,0.15)",
                  color: "#4ecdc4",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 9px",
                  borderRadius: 999,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {exhibit.kind === "meta" && (
          <p style={{ margin: "14px 0 0", color: "#a8e6cf", fontSize: 14 }}>
            People here right now: <strong>{Math.max(1, playerCount)}</strong>
          </p>
        )}

        {exhibit.links.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
            {exhibit.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "#4ecdc4",
                  color: "#10101a",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "8px 14px",
                  borderRadius: 6,
                }}
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
