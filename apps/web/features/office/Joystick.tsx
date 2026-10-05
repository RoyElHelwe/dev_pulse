'use client';

import { useEffect, useRef, useState } from 'react';
import type { OfficeController } from '@/game/createGame';

const RADIUS = 52;

/** On touch screens: drag the knob to walk (keyboards keep working too). */
export function Joystick({ controller }: { controller: OfficeController | null }) {
  const [touch, setTouch] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  useEffect(() => setTouch(window.matchMedia('(pointer: coarse)').matches), []);

  if (!touch || !controller) return null;

  const move = (e: React.PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let x = e.clientX - (rect.left + rect.width / 2);
    let y = e.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(x, y);
    if (length > RADIUS) {
      x = (x / length) * RADIUS;
      y = (y / length) * RADIUS;
    }
    setKnob({ x, y });
    // A small dead zone so a resting thumb doesn't walk.
    const k = Math.hypot(x, y) < 8 ? 0 : 1 / RADIUS;
    controller.setJoystick(x * k, y * k);
  };
  const stop = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    controller.setJoystick(0, 0);
  };

  return (
    <div
      ref={base}
      role="application"
      aria-label="Joystick: drag to walk"
      className="absolute right-6 bottom-8 size-32 touch-none rounded-full border border-white/70 bg-white/45 shadow-lg backdrop-blur-md select-none"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => e.pointerId === pointer.current && move(e)}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <div
        className="absolute top-1/2 left-1/2 size-14 rounded-full bg-zinc-900/80 shadow-md ring-4 ring-white/60 transition-transform duration-75"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
