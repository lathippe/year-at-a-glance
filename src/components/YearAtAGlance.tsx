"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OrreryDial } from "./OrreryDial";
import { helioPositions } from "@/lib/helio";
import { useSelectedDate } from "@/lib/selectedDate";
import { useEasedDate } from "@/lib/useEasedDate";

const DAY = 86400000;
const MONTH = 30.44 * DAY;
/** Sixteen months on the ruler at a time, walked three at a step. */
const SPAN = Math.round(16 * MONTH);
const STEP = Math.round(3 * MONTH);
/** How far back the sky is drawn when the page opens, and how long it takes to
    catch up. Three weeks is enough for the Moon to swing right round and for
    Mercury to cross a sign — a glance at how today was arrived at, not a tour. */
const INTRO_DAYS = 22;
const INTRO_MS = 3400;

/** Calendar arithmetic, not 86 400 000 ms. Adding a day's worth of milliseconds
    to local midnight lands on 23:00 of the same day when the clocks go back, and
    the day snap then hands the same date straight back: the dial sticks. */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * A cover, not a page. The dial is sized to the largest square that fits the
 * space left over, so the whole circle is on screen at once and stays in the
 * middle of it on a phone, where the space is far taller than it is wide.
 *
 * One date drives all of it, and it lives in the shared context — which is what
 * makes the wheel move the ruler and the readout for free.
 */
export function YearAtAGlance() {
  const { selected, setSelected } = useSelectedDate();
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const [nowMs] = useState(() => Date.now());
  // The ruler's window. It starts around today and can be walked either way, so
  // the year on screen is never the only year there is.
  const [start, setStart] = useState(() => selected.getTime() - SPAN * 0.35);

  // The sky opens a few weeks back and glides up to today. Nothing runs after
  // that: a chart that keeps moving is a screen saver, you wait for it instead
  // of reading it. The offset is milliseconds, not days, so the planets travel
  // rather than tick.
  const [lag, setLag] = useState(-INTRO_DAYS * DAY);
  const introRaf = useRef<number | null>(null);
  const cancelIntro = () => {
    if (introRaf.current != null) {
      cancelAnimationFrame(introRaf.current);
      introRaf.current = null;
    }
    setLag(0);
  };
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setLag(0);
      return;
    }
    const from = -INTRO_DAYS * DAY;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / INTRO_MS);
      // Ease in and out: it leaves and arrives at rest, which is what makes the
      // arrival read as settling rather than stopping.
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setLag(from * (1 - e));
      if (k < 1) introRaf.current = requestAnimationFrame(tick);
      else introRaf.current = null;
    };
    introRaf.current = requestAnimationFrame(tick);
    return () => {
      if (introRaf.current != null) cancelAnimationFrame(introRaf.current);
    };
  }, []);

  // Days are quantised — the readout wants a date, not an instant — so stepping
  // one would teleport the planets. This walks the real ephemeris between the
  // two days instead, and the intro's lag rides on top of it.
  const eased = useEasedDate(selected);
  const planets = useMemo(
    () => helioPositions(new Date(eased.getTime() + lag)),
    [eased, lag]
  );

  const t = Math.min(1, Math.max(0, (selected.getTime() - start) / SPAN));
  const shift = (dir: 1 | -1) => {
    cancelIntro();
    setStart((v) => v + dir * STEP);
  };
  const today = () => {
    cancelIntro();
    setSelected(new Date(nowMs));
    // Recentre only when today has fallen off the ruler, so pressing it twice
    // does not shuffle the window about.
    if (nowMs < start || nowMs > start + SPAN) setStart(nowMs - SPAN * 0.35);
  };

  // The wheel belongs to the whole cover, not just the disc. Scrolling with the
  // pointer out in the margin is the same gesture as scrolling over a planet,
  // and there is nothing else on the page for it to do.
  const selRef = useRef(selected);
  useEffect(() => {
    selRef.current = selected;
  }, [selected]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let acc = 0;
    const PX_PER_DAY = 36;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelIntro();
      acc += e.deltaY;
      const days = Math.trunc(acc / PX_PER_DAY);
      if (!days) return;
      acc -= days * PX_PER_DAY;
      setSelected(addDays(selRef.current, days));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setSelected]);

  // The hint starts as the invitation and turns into the way back, but only once
  // the invitation has plainly been taken: enough days travelled that scrubbing
  // is understood, and enough time that the change is not a flicker.
  const [hint, setHint] = useState<"scroll" | "reset">("scroll");
  // A phone has neither a wheel nor an R key. The ruler is draggable on both, so
  // on touch that is the instruction, and the way back is the button.
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(!!window.matchMedia?.("(hover: none)").matches), []);
  const travelled = useRef(0);
  const prev = useRef(selected.getTime());
  useEffect(() => {
    travelled.current += Math.abs(selected.getTime() - prev.current) / DAY;
    prev.current = selected.getTime();
    if (travelled.current >= 40 && Date.now() - nowMs > 7000) setHint("reset");
  }, [selected, nowMs]);

  const act = useRef(today);
  act.current = today;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Both layouts: r and t sit under к and е on a Russian keyboard.
      if ("rtке".includes(e.key.toLowerCase())) act.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Scroll far enough and the date walks off the end of the ruler. Rather than
  // pin the knob to the edge and leave it reading nothing, the window follows:
  // the knob stops near the edge and the months slide under it, so which month
  // and which year is being scrubbed is always on screen.
  useEffect(() => {
    if (dragging) return;
    const ms = selected.getTime();
    const lo = start + SPAN * 0.1;
    const hi = start + SPAN * 0.9;
    if (ms < lo) setStart(ms - SPAN * 0.1);
    else if (ms > hi) setStart(ms - SPAN * 0.9);
  }, [selected, start, dragging]);

  // Sixteen labels do not fit across a phone: on a 358-pixel ruler they ran into
  // each other and read as one long word. The ticks all stay — they are what the
  // knob is placed against — and only the naming thins out.
  const [trackW, setTrackW] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTrackW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const stride = trackW && trackW < 420 ? 3 : trackW && trackW < 700 ? 2 : 1;

  const moveTo = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setSelected(new Date(start + k * SPAN));
  };

  const months = useMemo(() => {
    const out: { ms: number; label: string; year: boolean; m: number }[] = [];
    const d = new Date(start);
    const cur = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    while (cur.getTime() <= start + SPAN) {
      const jan = cur.getUTCMonth() === 0;
      out.push({
        ms: cur.getTime(),
        // January carries the year instead of its own name. On a ruler that can
        // be walked out of the year it opened in, "Jan" is the one label that
        // leaves the question open.
        label: jan
          ? String(cur.getUTCFullYear())
          : cur.toLocaleDateString("en-GB", { month: "short" }),
        year: jan,
        m: cur.getUTCMonth(),
      });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return out;
  }, [start]);

  return (
    <div className="flex flex-col items-center">
      <div
        ref={root}
        className="h-[100dvh] w-full flex flex-col items-center px-4 pt-5 pb-4 overscroll-none"
      >
        <header className="flex flex-col items-center gap-0.5 shrink-0">
          {/* The only text on the page. It is the readout for the wheel, and
              knowing where you have scrolled to is the whole interaction. */}
          <span className="display" style={{ fontSize: "clamp(17px, 4.4vw, 21px)", lineHeight: 1.2 }}>
            {selected.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <span className="label">
            {hint === "scroll"
              ? touch
                ? "drag the ruler"
                : "scroll the dial"
              : touch
                ? "tap today to come back"
                : "press R or T to reset to today"}
          </span>
        </header>

        {/* Size containment turns the leftover height into a unit the square can
            be built from: the largest square that fits, centred in what is left.
            Sizing it off the height alone left it hanging from the top of a
            phone screen, where the space is far taller than it is wide. */}
        <div
          className="flex-1 min-h-0 w-full flex items-center justify-center"
          style={{ containerType: "size" }}
          onPointerDown={cancelIntro}
        >
          <div style={{ width: "min(100%, 100cqh)", aspectRatio: "1 / 1" }}>
            <OrreryDial
              planets={planets}
              maxWidth={1400}
              aspectMode="chord"
              personal={false}
              wheelScrub={false}
            />
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
              cancelIntro();
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
                      top: m.year ? -6 : -4,
                      width: 1,
                      height: m.year ? 12 : 8,
                      background: "var(--border-strong)",
                      opacity: m.year ? 0.9 : 0.45,
                    }}
                  />
                  {(m.year || m.m % stride === 0) && p > 2 && p < 98 && (
                    <div
                      className="absolute -translate-x-1/2 label whitespace-nowrap"
                      style={{ top: 9, opacity: m.year ? 1 : undefined }}
                    >
                      {m.label}
                    </div>
                  )}
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
