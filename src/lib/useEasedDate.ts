"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The moment the sky is drawn at, easing toward the day that was chosen.
 *
 * Days are quantised on purpose — every other panel needs a day, not an instant
 * — so stepping the date teleported the planets. This walks the real ephemeris
 * between the two moments rather than tweening pixels: every frame on the way is
 * a place the sky actually was, so nothing is invented to make the motion look
 * nice.
 *
 * A jump of months is a change of subject, not a movement, and crawling through
 * it would be slow and meaningless. Past the cut it lands immediately.
 */
export function useEasedDate(target: Date, maxDays = 45): Date {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = shownRef.current.getTime();
    const to = target.getTime();
    if (from === to) return;

    const span = Math.abs(to - from);
    if (span > maxDays * 86400000) {
      shownRef.current = new Date(to);
      setShown(new Date(to));
      return;
    }

    const dur = Math.min(420, 130 + (span / 86400000) * 24);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const at = new Date(from + (to - from) * eased);
      shownRef.current = at;
      setShown(at);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, maxDays]);

  return shown;
}
