"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OrreryDial } from "./OrreryDial";
import { helioPositions } from "@/lib/helio";
import { useIsDark } from "@/lib/useIsDark";
import { useSelectedDate } from "@/lib/selectedDate";
import type { SkyBar } from "@/lib/skyRibbon";

const DAY = 86400000;
const START = Date.UTC(2026, 0, 1);
const END = Date.UTC(2027, 3, 30);
const SPAN_MS = END - START;

/** −1 tension … +1 harmony → the ink the dial uses for the same thing. */
function valenceInk(v: number, night: boolean): string {
  if (v < -0.05) return night ? "#d24a3a" : "#b8392b";
  if (v > 0.05) return "#4db8b0";
  return "#8b7fa8";
}

/**
 * The page. One date drives everything — the dial, the cursor, the readout — and
 * that date lives in the shared context, which is what makes the dial's own
 * wheel scrubbing move the whole page for free.
 *
 * The opening drift is short on purpose. A chart that keeps moving is a screen
 * saver: you wait for it instead of reading it. A few weeks of slow travel says
 * "this thing moves, and you are the one who moves it", and then it stops and
 * hands the wheel over.
 */
export function YearAtAGlance({ bars }: { bars: SkyBar[] }) {
  const night = useIsDark();
  const { selected, setSelected } = useSelectedDate();
  const [drifting, setDrifting] = useState(true);
  const raf = useRef<number | null>(null);
  // Where the drift starts, read once at mount. Counting days from a fixed base
  // means the ticker never has to read the current date back, so it does not
  // restart itself every day that passes.
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
      // One day every 320 ms: slow enough that a planet visibly creeps rather
      // than jumps, and about eight seconds for the whole drift.
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
  const nowMs = selected.getTime();
  const t = Math.min(1, Math.max(0, (nowMs - START) / SPAN_MS));
  const shown = bars.slice(0, 9);

  const stop = () => setDrifting(false);

  return (
    <div className="flex flex-col items-center gap-9">
      <header className="flex flex-col items-center gap-3 px-6 text-center">
        <h1 className="display" style={{ fontSize: 40, lineHeight: 1.05 }}>
          Year at a Glance
        </h1>
        <p
          className="text-[color:var(--muted-strong)] max-w-[46ch]"
          style={{ fontSize: 15, lineHeight: 1.55 }}
        >
          The planets keep their real angles. Scroll over the dial to move
          through the year and watch them travel.
        </p>
      </header>

      {/* The date is the readout for the scroll, so it sits with the dial and is
          the largest thing on the page after the title. */}
      <div className="flex flex-col items-center gap-1">
        <span className="display" style={{ fontSize: 26, lineHeight: 1 }}>
          {selected.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </span>
        <span className="label">{drifting ? "drifting · scroll to take over" : "scroll over the dial"}</span>
      </div>

      <div
        className="w-full flex justify-center"
        onWheelCapture={stop}
        onPointerDown={stop}
      >
        <OrreryDial planets={planets} maxWidth={720} aspectMode="chord" personal={false} />
      </div>

      <section className="flex flex-col items-center gap-4 px-6 text-center">
        <h2 className="label">What the dial does</h2>
        <div className="grid gap-x-10 gap-y-4 sm:grid-cols-3 max-w-[62rem]">
          {[
            {
              t: "Angles true, distances not",
              d: "Mercury to Neptune is 0.4 to 30 AU. Drawn to scale the inner four collapse onto the Sun, so the rings are spaced for reading. Every angle on the dial is exact.",
            },
            {
              t: "An arc is an aspect",
              d: "Click the Sun to bring them in. Two planets at a significant angle are joined by one thin arc, bowed outward so three of them can never close into a triangle.",
            },
            {
              t: "The waist is the hardness",
              d: "Every arc thins in the middle. A trine barely dips, a square nearly parts, an opposition comes apart completely.",
            },
          ].map((c) => (
            <div key={c.t} className="flex flex-col items-center gap-1.5">
              <span className="text-[13px] text-[color:var(--foreground)]">{c.t}</span>
              <p className="text-[12px] leading-relaxed text-[color:var(--muted)] max-w-[34ch]">
                {c.d}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-5 mt-1">
          {([
            ["Harmony", 1],
            ["Conjunction", 0],
            ["Tension", -1],
          ] as const).map(([label, v]) => (
            <span key={label} className="flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
              <svg width="34" height="8" aria-hidden>
                <defs>
                  <linearGradient id={`k${v}`} x1="0" x2="1">
                    <stop offset="0%" stopColor={valenceInk(v, night)} stopOpacity={1} />
                    <stop
                      offset="50%"
                      stopColor={valenceInk(v, night)}
                      stopOpacity={v < 0 ? 0.1 : v > 0 ? 0.78 : 1}
                    />
                    <stop offset="100%" stopColor={valenceInk(v, night)} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <path d="M1 6 Q17 1 33 6" fill="none" stroke={`url(#k${v})`} strokeWidth={1.4} />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="w-full max-w-[62rem] px-6 flex flex-col items-center gap-3">
        <h2 className="label">The year on one line</h2>
        <div className="w-full flex flex-col gap-[5px]">
          <div className="relative h-5">
            {[0, 3, 6, 9, 12, 15].map((m) => {
              const ms = Date.UTC(2026, m, 1);
              if (ms > END) return null;
              return (
                <span
                  key={m}
                  className="absolute label -translate-x-1/2"
                  style={{ left: `${((ms - START) / SPAN_MS) * 100}%` }}
                >
                  {new Date(ms).toLocaleDateString("en-GB", {
                    month: "short",
                    ...(m % 12 === 0 ? { year: "numeric" } : {}),
                  })}
                </span>
              );
            })}
          </div>
          {shown.map((b) => {
            const left = Math.max(0, ((b.from - START) / SPAN_MS) * 100);
            const right = Math.min(100, ((b.to - START) / SPAN_MS) * 100);
            const peak = ((b.peak - START) / SPAN_MS) * 100;
            const live = nowMs >= b.from && nowMs <= b.to;
            const ink = valenceInk(b.valence, night);
            return (
              <div
                key={b.key}
                className="relative h-[13px]"
                title={`${b.label} · closest ${b.bestOrb.toFixed(1)}°`}
              >
                <span
                  className="absolute rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(0.5, right - left)}%`,
                    top: "50%",
                    height: 1.6,
                    transform: "translateY(-50%)",
                    background: ink,
                    opacity: live ? 0.95 : 0.3,
                  }}
                />
                {peak >= 0 && peak <= 100 && (
                  <span
                    className="absolute rounded-full"
                    style={{
                      left: `${peak}%`,
                      top: "50%",
                      width: 4,
                      height: 4,
                      marginLeft: -2,
                      transform: "translateY(-50%)",
                      background: ink,
                      opacity: live ? 1 : 0.45,
                    }}
                  />
                )}
              </div>
            );
          })}
          <div className="relative h-6 mt-1">
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[color:var(--border)]" />
            <div
              className="absolute top-1/2 rounded-full"
              style={{
                left: `${t * 100}%`,
                width: 9,
                height: 9,
                transform: "translate(-50%, -50%)",
                background: "var(--accent)",
                border: "2px solid var(--surface)",
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
