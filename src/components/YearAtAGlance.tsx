"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OrreryDial } from "./OrreryDial";
import { helioPositions } from "@/lib/helio";
import { useSelectedDate } from "@/lib/selectedDate";

const DAY = 86400000;
const MONTH = 30.44 * DAY;
/** Sixteen months on the ruler at a time, walked three at a step. */
const SPAN = Math.round(16 * MONTH);
const STEP = Math.round(3 * MONTH);

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
  const { selected, setSelected } = useSelectedDate();
  const [drifting, setDrifting] = useState(true);
  const [dragging, setDragging] = useState(false);
  const raf = useRef<number | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  // Counting days from a fixed base means the ticker never reads the date back,
  // so it does not restart itself on every day that passes.
  const [base] = useState(() => selected);
  const [nowMs] = useState(() => Date.now());
  // The ruler's window. It starts around today and can be walked either way, so
  // the year on screen is never the only year there is.
  const [start, setStart] = useState(() => selected.getTime() - SPAN * 0.35);

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
  const t = Math.min(1, Math.max(0, (selected.getTime() - start) / SPAN));
  const shift = (dir: 1 | -1) => {
    stop();
    setStart((v) => v + dir * STEP);
  };
  const today = () => {
    stop();
    const now = nowMs;
    setSelected(new Date(now));
    // Recentre only when today has fallen off the ruler, so pressing it twice
    // does not shuffle the window about.
    if (now < start || now > start + SPAN) setStart(now - SPAN * 0.35);
  };
  const stop = () => setDrifting(false);

  const moveTo = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setSelected(new Date(start + k * SPAN));
  };

  const months = useMemo(() => {
    const out: { ms: number; label: string; year: boolean }[] = [];
    const d = new Date(start);
    const cur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    while (cur.getTime() <= start + SPAN) {
      out.push({
        ms: cur.getTime(),
        label: cur.toLocaleDateString("en-GB", { month: "short" }),
        year: cur.getUTCMonth() === 0,
      });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return out;
  }, [start]);

  return (
    <div className="flex flex-col items-center">
      <div className="h-[100dvh] w-full flex flex-col items-center px-4 pt-5 pb-4">
        <header className="flex flex-col items-center gap-0.5 shrink-0">
          {/* The only text on the page. It is the readout for the wheel, and
              knowing where you have scrolled to is the whole interaction. */}
          <span className="display" style={{ fontSize: 21, lineHeight: 1.2 }}>
            {selected.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <span className="label">scroll the dial</span>
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
        <div className="w-full max-w-[54rem] shrink-0 select-none flex flex-col items-center gap-1">
          <div
            ref={track}
            className="relative h-9 w-full cursor-ew-resize touch-none"
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
              const p = ((m.ms - start) / SPAN) * 100;
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
          <div className="flex items-center gap-1.5">
            {([["‹", -1], ["today", 0], ["›", 1]] as const).map(([label, dir]) => (
              <button
                key={label}
                type="button"
                onClick={() => (dir === 0 ? today() : shift(dir as 1 | -1))}
                aria-label={dir === 0 ? "Back to today" : dir < 0 ? "Earlier" : "Later"}
                className="rounded-full border border-[color:var(--border)] hover:border-[color:var(--border-strong)] transition-colors text-[color:var(--muted-strong)] h-6 px-2.5 text-[11px] leading-none cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
