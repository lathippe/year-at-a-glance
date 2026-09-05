"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OrreryDial } from "./OrreryDial";
import { helioPositions } from "@/lib/helio";
import { useIsDark } from "@/lib/useIsDark";
import type { SkyBar } from "@/lib/skyRibbon";

const DAY = 86400000;
// A fixed calendar window rather than a rolling one: the page is a portrait of
// this stretch of sky, and a reader who comes back in a month should see the
// same picture rather than a quietly different one.
const START = Date.UTC(2026, 0, 1);
const END = Date.UTC(2027, 3, 30);
const SPAN_MS = END - START;

/** −1 tension … +1 harmony → the ink the dial uses for the same thing. */
function valenceInk(v: number, night: boolean): string {
  if (v < -0.05) return night ? "#d24a3a" : "#b8392b";
  if (v > 0.05) return "#4db8b0";
  return "#8b7fa8";
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The whole page: a year of sky, played through once on arrival and then left
 * on today. No birth data anywhere — the chart is the same for everyone, which
 * is the only thing a public page can honestly show.
 */
export function YearAtAGlance({ bars }: { bars: SkyBar[] }) {
  const night = useIsDark();
  // The reader's today, read once on the client. The server's clock would be
  // right by accident and wrong for anyone in another timezone.
  const [todayMs] = useState(() => Date.now());
  // Position in the window, 0 at the first of January 2026 and 1 at the end.
  const todayT = Math.min(1, Math.max(0, (todayMs - START) / SPAN_MS));
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    // Asked for less motion: settle on today and never start. Done in a frame
    // callback rather than in the effect body so the first render matches the
    // server's and hydration stays quiet.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => {
        setT(todayT);
        setPlaying(false);
      });
      return () => cancelAnimationFrame(id);
    }
    let last = 0;
    const tick = (now: number) => {
      // About twelve days a second: slow enough to watch a square close, fast
      // enough that the whole year is over before anyone loses interest.
      if (now - last > 34) {
        last = now;
        setT((v) => {
          if (v >= 1) {
            setPlaying(false);
            return todayT; // settle on today when the year is done
          }
          return v + 1 / (SPAN_MS / DAY) * 2; // about two days a frame
        });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [playing, todayT]);

  const date = useMemo(() => new Date(START + t * SPAN_MS), [t]);
  const planets = useMemo(() => helioPositions(date), [date]);
  const nowMs = date.getTime();
  const pct = t * 100;
  const shown = bars.slice(0, 9);

  return (
    <div className="flex flex-col items-center gap-10">
      <header className="flex flex-col items-center gap-3 px-6 text-center">
        <h1 className="display" style={{ fontSize: 40, lineHeight: 1.05 }}>
          Year at a Glance
        </h1>
        <p
          className="text-[color:var(--muted-strong)] max-w-[46ch]"
          style={{ fontSize: 15, lineHeight: 1.55 }}
        >
          January 2026 to the spring of 2027. The planets keep their real
          angles, the aspects between them come and go, and the whole stretch
          plays through once when the page opens.
        </p>
      </header>

      <div className="w-full flex justify-center">
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
              d: "Two planets at a significant angle are joined by one thin arc, bowed outward so three of them can never close into a triangle.",
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
          {[
            ["Harmony", 1],
            ["Conjunction", 0],
            ["Tension", -1],
          ].map(([label, v]) => (
            <span key={label as string} className="flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
              <svg width="34" height="8" aria-hidden>
                <defs>
                  <linearGradient id={`k${v}`} x1="0" x2="1">
                    <stop offset="0%" stopColor={valenceInk(v as number, night)} stopOpacity={1} />
                    <stop
                      offset="50%"
                      stopColor={valenceInk(v as number, night)}
                      stopOpacity={(v as number) < 0 ? 0.1 : (v as number) > 0 ? 0.78 : 1}
                    />
                    <stop offset="100%" stopColor={valenceInk(v as number, night)} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <path d="M1 6 Q17 1 33 6" fill="none" stroke={`url(#k${v})`} strokeWidth={1.4} />
              </svg>
              {label as string}
            </span>
          ))}
        </div>
      </section>

      {/* The same year on a straight axis: every slow aspect as the window it is
          open for, thickest where it is tightest. */}
      <section className="w-full max-w-[62rem] px-6 flex flex-col items-center gap-3">
        <h2 className="label">The year on one line</h2>
        <div className="w-full flex flex-col gap-[5px]">
          <div className="relative h-5">
            {[0, 3, 6, 9, 12, 15].map((m) => {
              const ms = Date.UTC(2026, m, 1);
              if (ms > END) return null;
              const p = ((ms - START) / SPAN_MS) * 100;
              return (
                <span
                  key={m}
                  className="absolute label -translate-x-1/2"
                  style={{ left: `${p}%` }}
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
              <div key={b.key} className="relative h-[13px] group" title={`${b.label} · ${fmt(b.from)} → ${fmt(b.to)} · closest ${b.bestOrb.toFixed(1)}°`}>
                <span
                  className="absolute rounded-full"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(0.5, right - left)}%`,
                    top: "50%",
                    height: 1.6,
                    transform: "translateY(-50%)",
                    background: ink,
                    opacity: live ? 0.95 : 0.32,
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
                left: `${pct}%`,
                width: 9,
                height: 9,
                transform: "translate(-50%, -50%)",
                background: "var(--accent)",
                border: "2px solid var(--surface)",
              }}
            />
            <span
              className="absolute label -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${Math.min(92, Math.max(8, pct))}%`, top: 18 }}
            >
              {date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (t >= 1 || !playing) setT(0);
            setPlaying((p) => !p);
          }}
          className="mt-6 rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[12px] leading-none text-[color:var(--foreground)] hover:bg-[color:var(--surface-sunk)] transition-colors cursor-pointer"
        >
          {playing ? "Pause" : "Replay the year"}
        </button>
      </section>
    </div>
  );
}
