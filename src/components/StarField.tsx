"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useIsDark } from "@/lib/useIsDark";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sky behind the page, not just inside the dial. The dial's own stars stop
 * at its viewBox, so on a wide screen the whole left and right of the page was
 * empty black — the dial looked like a picture hung on a wall rather than a
 * thing floating in the middle of somewhere very large.
 *
 * Small and dim, and every star on its own cycle: most breathe, a quarter of
 * them flare past their resting brightness for a moment. Out of step on purpose,
 * so the sky never pulses as one thing. At this size it reads as depth; any
 * larger and it competes with the planets, which are the only things on the
 * page allowed to be bright.
 */
export function StarField() {
  const night = useIsDark();
  const stars = useMemo(() => {
    const rnd = mulberry32(90210);
    return Array.from({ length: 260 }, () => {
      const bright = rnd();
      return {
        x: rnd() * 100,
        y: rnd() * 100,
        s: 0.6 + bright * bright * 1.5,
        o: 0.06 + bright * 0.34,
        warm: rnd() > 0.9,
        sparkle: rnd() > 0.72,
        delay: rnd() * 9,
        dur: 2.2 + rnd() * 4.5,
      };
    });
  }, []);

  if (!night) return null;

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="star absolute rounded-full"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              background: s.warm ? "#ffe9c9" : "#dfe7f5",
              "--o": s.o,
              opacity: s.o,
              animation: `${s.sparkle ? "star-sparkle" : "star-twinkle"} ${s.dur.toFixed(1)}s ease-in-out ${s.delay.toFixed(1)}s infinite`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
