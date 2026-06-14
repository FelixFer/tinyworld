import { useRef, useState } from "react";

const SIZE = 120; // base diameter
const RADIUS = 44; // max thumb travel from center
const THUMB = 56;

interface JoystickProps {
  /** Normalized direction in [-1, 1]; up is negative y. (0, 0) when released. */
  onMove: (dx: number, dy: number) => void;
}

export function Joystick({ onMove }: JoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  const handle = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > RADIUS) {
      dx = (dx / dist) * RADIUS;
      dy = (dy / dist) * RADIUS;
    }
    setThumb({ x: dx, y: dy });
    onMove(dx / RADIUS, dy / RADIUS);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    activeId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    handle(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (activeId.current === e.pointerId) handle(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return;
    activeId.current = null;
    setThumb({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden="true"
      style={{
        position: "absolute",
        bottom: "calc(32px + env(safe-area-inset-bottom))",
        left: "calc(32px + env(safe-area-inset-left))",
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.25)",
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: THUMB,
          height: THUMB,
          marginLeft: -THUMB / 2,
          marginTop: -THUMB / 2,
          transform: `translate(${thumb.x}px, ${thumb.y}px)`,
          borderRadius: "50%",
          background: "rgba(78,205,196,0.55)",
          border: "1px solid #4ecdc4",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
