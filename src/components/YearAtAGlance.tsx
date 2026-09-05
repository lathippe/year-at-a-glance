"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OrreryDial } from "./OrreryDial";
import { helioPositions } from "@/lib/helio";
import { useIsDark } from "@/lib/useIsDark";
import { useSelectedDate } from "@/lib/selectedDate";

const DAY = 86400000;
const START = Date.UTC(2026, 0, 1);
const END = Date.UTC(2027, 3, 30);
const SPAN = END - START;

function ink(v: number, night: boolean): string {
  if (v < 0) return night ? "#d24a3a" : "#b8392b";
  if (v > 0) return "#4db8b0";
  return "#8b7fa8";
}

/**
 * A cover, not a page. The dial is sized by the height it is given, so the whole
 * circle is on screen at once, and the ruler under it is the only other thing.
 *
 * One date drives all of it, and it lives in the shared context — which is what
 * makes the dial's own wheel scrubbing move the ruler and the readout for free.
 */
export function YearAtAGlance() {
  const night = useIsDark();
  const { selected, setSelected } = useSelectedDate();
  const [drifting, setDrifting] = useState(true);
  const [dragging, setDragging] = useState(false);
  const raf = useRef<number | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  // Counting days from a fixed base means the ticker never reads the date back,
  // so it does not restart itself on every day that passes.
  const [base] = useState(() => selected);

  useEffect(() => {
    if (!drifting) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setDrifting(false));
      return () => cancelAnimationFrame(id);
    }
    let last = 0;
    let day = 0;
    const tick = (now: number) => {
      // A day every 320 ms, twenty-five days, then it stops and hands over. A
      // chart that keeps moving is a screen saver: you wait for it instead of
      // reading it.
      if (now - last > 320) {
        last = now;
        day += 1;
        setSelected(new Date(base.getTime() + day * DAY));
        if (day >= 25) {
          setDrifting(false);
          return;
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [drifting, setSelected, base]);

  const planets = useMemo(() => helioPositions(selected), [selected]);
  const t = Math.min(1, Math.max(0, (selected.getTime() - START) / SPAN));
  const stop = () => setDrifting(false);

  const moveTo = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setSelected(new Date(START + k * SPAN));
  };

  const months = useMemo(() => {
    const out: { ms: number; label: string; year: boolean }[] = [];
    for (let m = 0; ; m++) {
      const ms = Date.UTC(2026, m, 1);
      if (ms > END) break;
      out.push({
        ms,
        label: new Date(ms).toLocaleDateString("en-GB", { month: "short" }),
        year: m % 12 === 0,
      });
    }
    return out;
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="h-[100dvh] w-full flex flex-col items-center px-4 pt-5 pb-4">
        <header className="flex flex-col items-center gap-1 shrink-0">
          <h1 className="display" style={{ fontSize: 24, lineHeight: 1.1 }}>
            Year at a Glance
          </h1>
          {/* The readout for the wheel: knowing where you have scrolled to is
              the whole interaction, so it is the biggest thing here. */}
          <span className="display" style={{ fontSize: 19, lineHeight: 1.25 }}>
            {selected.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <span className="label">{drifting ? "scroll to take over" : "scroll the dial"}</span>
        </header>

        <div
          className="flex-1 min-h-0 w-full flex items-center justify-center"
          onWheelCapture={stop}
          onPointerDown={stop}
        >
          <div className="h-full aspect-square max-w-full">
            <OrreryDial planets={planets} maxWidth={1400} aspectMode="chord" personal={false} />
          </div>
        </div>

        {/* Just a ruler. The aspect bars that used to live here said the same
            thing the dial says, one scroll away, and took a third of the cover
            to say it. */}
        <div className="w-full max-w-[54rem] shrink-0 select-none">
          <div
            ref={track}
            className="relative h-9 cursor-ew-resize touch-none"
            onPointerDown={(e) => {
              stop();
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              setDragging(true);
              moveTo(e.clientX);
            }}
            onPointerMove={(e) => dragging && moveTo(e.clientX)}
            onPointerUp={(e) => {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              setDragging(false);
            }}
            onPointerCancel={() => setDragging(false)}
          >
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[color:var(--border)]" />
            {months.map((m) => {
              const p = ((m.ms - START) / SPAN) * 100;
              return (
                <div key={m.ms} className="absolute top-1/2" style={{ left: `${p}%` }}>
                  <div
                    className="absolute -translate-x-1/2"
                    style={{
                      top: -4,
                      width: 1,
                      height: 8,
                      background: "var(--border-strong)",
                      opacity: m.year ? 0.9 : 0.45,
                    }}
                  />
                  <div className="absolute -translate-x-1/2 label whitespace-nowrap" style={{ top: 9 }}>
                    {m.label}
                  </div>
                </div>
              );
            })}
            <div
              className="absolute top-1/2 rounded-full pointer-events-none"
              style={{
                left: `${t * 100}%`,
                width: dragging ? 15 : 12,
                height: dragging ? 15 : 12,
                transform: "translate(-50%, -50%)",
                background: "var(--accent)",
                border: "2px solid var(--surface)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                transition: "width 120ms, height 120ms",
              }}
            />
          </div>
        </div>
      </div>

      <section className="w-full max-w-[62rem] px-6 pb-16 flex flex-col items-center gap-5 text-center">
        <h2 className="label">What the dial does</h2>
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-3 w-full">
          {[
            ["Angles true, distances not", "Rings are spaced for reading. Every angle is exact."],
            ["An arc is an aspect", "Click the Sun to bring them in."],
            ["The waist is the hardness", "A trine barely dips. An opposition comes apart."],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <span className="text-[13px] text-[color:var(--foreground)]">{t}</span>
              <p className="text-[12px] leading-relaxed text-[color:var(--muted)] max-w-[30ch]">{d}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-5">
          {([["Harmony", 1], ["Conjunction", 0], ["Tension", -1]] as const).map(([label, v]) => (
            <span key={label} className="flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
              <svg width="34" height="8" aria-hidden>
                <defs>
                  <linearGradient id={`k${v}`} x1="0" x2="1">
                    <stop offset="0%" stopColor={ink(v, night)} stopOpacity={1} />
                    <stop offset="50%" stopColor={ink(v, night)} stopOpacity={v < 0 ? 0.1 : v > 0 ? 0.78 : 1} />
                    <stop offset="100%" stopColor={ink(v, night)} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <path d="M1 6 Q17 1 33 6" fill="none" stroke={`url(#k${v})`} strokeWidth={1.4} />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
