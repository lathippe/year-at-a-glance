"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { OrreryDial } from "./OrreryDial";
import { helioPositions } from "@/lib/helio";
import { useSelectedDate } from "@/lib/selectedDate";

const DAY = 86400000;
const MONTH = 30.44 * DAY;
/** Sixteen months of ruler at a time. */
const SPAN = Math.round(16 * MONTH);
/** How far back the sky is drawn when the page opens, and how long it takes to
    catch up. Three weeks is enough for the Moon to swing right round and for
    Mercury to cross a sign — a glance at how today was arrived at, not a tour. */
const INTRO_DAYS = 22;
const INTRO_MS = 3400;
/** How hard the sky is pulled toward the chosen day while scrubbing. Small
    enough that the planets feel dragged rather than dropped, short enough that
    the date under the wheel is never visibly behind the wheel. */
const CHASE_TAU = 80;

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
  const { selected, setSelected, today: todayDate } = useSelectedDate();
  const todayMs = todayDate.getTime();
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const track = useRef<HTMLDivElement | null>(null);
  const [nowMs] = useState(() => Date.now());
  // The ruler's window. It starts around today and can be walked either way, so
  // the year on screen is never the only year there is.
  const [start, setStart] = useState(() => todayMs - SPAN * 0.35);

  // The moment actually drawn, which is not the same as the day chosen. Days are
  // quantised — the readout wants a date, not an instant — so drawing the chosen
  // day directly would teleport the planets from one midnight to the next. This
  // is the sky's own position, always on its way to the chosen day, and the date
  // and the ruler's knob are both read off it: what is drawn and what is written
  // can then never disagree.
  const [drawnMs, setDrawnMs] = useState(() => todayMs - INTRO_DAYS * DAY);
  const drawnRef = useRef(todayMs - INTRO_DAYS * DAY);
  const targetRef = useRef(todayMs);
  const tween = useRef<{ from: number; to: number; t0: number; dur: number; then?: () => void } | null>(null);
  const loop = useRef<number | null>(null);
  const last = useRef(0);
  const startRef = useRef(start);
  const draggingRef = useRef(dragging);
  useEffect(() => {
    startRef.current = start;
    draggingRef.current = dragging;
  }, [start, dragging]);

  // Two ways of moving, because there are two kinds of reason to move.
  //
  // Scrubbing is continuous: the wheel keeps arriving, and the sky should feel
  // dragged along behind it. That is an exponential chase — always heading for
  // wherever the day now is, no fixed destination to be interrupted.
  //
  // Opening the page, stepping a month and pressing today are single decisions
  // with a known start and end, and they deserve to be watched. Those get a
  // timed pass at a flat rate.
  const run = useCallback(() => {
    if (loop.current != null) return;
    last.current = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - last.current);
      last.current = now;
      const was = drawnRef.current;
      const tw = tween.current;
      if (tw) {
        // No easing. The planets move at one rate from start to finish and stop
        // where they arrive, which is how an orrery is cranked.
        const k = Math.min(1, (now - tw.t0) / tw.dur);
        drawnRef.current = tw.from + (tw.to - tw.from) * k;
        if (k >= 1) {
          drawnRef.current = tw.to;
          tween.current = null;
          tw.then?.();
        }
      } else {
        const d = targetRef.current - drawnRef.current;
        // Below a minute apart, stop: no screen can show the difference, and
        // chasing it forever would keep a frame loop alive on an idle page.
        if (Math.abs(d) < 60000) drawnRef.current = targetRef.current;
        else drawnRef.current += d * (1 - Math.exp(-dt / CHASE_TAU));
      }
      // Scroll far enough and the date walks off the end of the ruler. Rather
      // than pin the knob to the edge and leave it reading nothing, the window
      // follows: the knob stops near the edge and the months slide under it, so
      // which month and which year is being scrubbed is always on screen. Only
      // the date moving does this — the arrows pan the window on purpose, and
      // used to be dragged back the moment they went far enough.
      if (!draggingRef.current && drawnRef.current !== was) {
        const ms = drawnRef.current;
        const lo = startRef.current + SPAN * 0.1;
        const hi = startRef.current + SPAN * 0.9;
        if (ms < lo || ms > hi) {
          startRef.current = ms - SPAN * (ms < lo ? 0.1 : 0.9);
          setStart(startRef.current);
        }
      }
      setDrawnMs(drawnRef.current);
      if (tween.current || drawnRef.current !== targetRef.current) {
        loop.current = requestAnimationFrame(step);
      } else {
        loop.current = null;
      }
    };
    loop.current = requestAnimationFrame(step);
  }, []);

  const glide = useCallback(
    (from: number, to: number, dur: number, then?: () => void) => {
      // Even the instant case goes through the loop rather than setting state
      // here: called from an effect, a synchronous write is a cascading render,
      // and one frame is not a wait.
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      tween.current = { from: reduced ? to : from, to, t0: performance.now(), dur: reduced ? 1 : dur, then };
      run();
    },
    [run]
  );

  /** Hand the sky back to the chase, wherever it has got to. Any input during a
      timed pass ends it: the reader has changed their mind, and finishing an
      animation they have interrupted is the chart arguing with them. */
  const takeOver = useCallback(() => {
    tween.current = null;
    run();
  }, [run]);

  // The sky opens three weeks back and glides up to today, and then stops. A
  // chart that keeps moving is a screen saver: you wait for it instead of
  // reading it.
  useEffect(() => {
    glide(todayMs - INTRO_DAYS * DAY, todayMs, INTRO_MS);
  }, [glide, todayMs]);

  useEffect(() => {
    targetRef.current = selected.getTime();
    run();
  }, [selected, run]);
  useEffect(() => () => {
    if (loop.current != null) cancelAnimationFrame(loop.current);
  }, []);

  const drawn = useMemo(() => new Date(drawnMs), [drawnMs]);
  const planets = useMemo(() => helioPositions(drawn), [drawn]);

  const t = Math.min(1, Math.max(0, (drawnMs - start) / SPAN));
  /** One month either way. The arrows sit next to the date now, and a pair of
      arrows around a date can only mean the date: they used to pan the ruler's
      window instead, which was invisible from where they were about to stand.
      The window follows the date on its own anyway. */
  const stepMonth = (dir: 1 | -1) => {
    const d = drawnRef.current === targetRef.current ? new Date(drawnRef.current) : selected;
    const to = new Date(d.getFullYear(), d.getMonth() + dir, d.getDate());
    setSelected(to);
    glide(drawnRef.current, new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime(), 520);
  };
  const today = () => {
    const from = drawnRef.current;
    setSelected(todayDate);
    const days = Math.abs(from - todayMs) / DAY;
    if (days < 0.5) {
      // Already there. Cut any pass still running rather than animate nothing.
      takeOver();
      return;
    }
    // Long enough to be a journey, short enough not to be a wait. The floor
    // matters more than the ceiling: a week's return still has to read as a
    // return rather than a flicker.
    glide(from, todayMs, Math.min(2800, Math.max(700, 520 + days * 5)), () => {
      // The window slid along behind the date on the way back, which leaves today
      // parked against whichever edge the journey came from. Setting it straight
      // at the moment everything else comes to rest is the one instant a jump
      // costs nothing.
      startRef.current = todayMs - SPAN * 0.35;
      setStart(startRef.current);
    });
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
    let lastT = 0;
    let rate = 0;
    const PX_PER_DAY = 36;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      takeOver();
      // How hard the wheel is being turned, in pixels a millisecond, smoothed
      // over about a tenth of a second so one violent event cannot throw it. A
      // hurried scroll then covers more ground per turn than a careful one, the
      // way a map zooms further when you mean it: a year is 4000 pixels of wheel
      // at the flat rate, and nobody wants to sit through that to reach next
      // spring. The floor is the flat rate, so a slow scroll still steps days.
      const now = e.timeStamp || performance.now();
      const dt = lastT ? Math.min(240, Math.max(6, now - lastT)) : 60;
      lastT = now;
      rate += (Math.abs(e.deltaY) / dt - rate) * (1 - Math.exp(-dt / 50));
      const gain = Math.min(5, Math.max(1, rate / 0.9));
      acc += e.deltaY * gain;
      const days = Math.trunc(acc / PX_PER_DAY);
      if (!days) return;
      acc -= days * PX_PER_DAY;
      setSelected(addDays(selRef.current, days));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setSelected]);

  // The hint is the invitation while you are on today and the way back once you
  // are not. Ten days is the threshold rather than nothing at all: a nudge of
  // the wheel should not snatch away the instruction that got you to try it.
  const away = Math.abs(drawnMs - todayMs) >= 10 * DAY;

  // A phone has neither a wheel nor an R key. The ruler is draggable on both, so
  // on touch that is the instruction, and there are no shortcuts to print.
  const touch = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(hover: none)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(hover: none)").matches,
    () => false
  );

  const act = useRef(today);
  useEffect(() => {
    act.current = today;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Both layouts: r and t sit under к and е on a Russian keyboard.
      if ("rtке".includes(e.key.toLowerCase())) act.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <header className="flex flex-col items-center gap-1 shrink-0">
          {/* The only text on the page. It is the readout for the wheel, and
              knowing where you have scrolled to is the whole interaction. The
              arrows are here rather than under the ruler because this is the
              thing they move. */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => stepMonth(-1)} aria-label="A month earlier" className="step">
              ‹
            </button>
            <span className="display" style={{ fontSize: "clamp(17px, 4.4vw, 21px)", lineHeight: 1.2 }}>
              {drawn.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={() => stepMonth(1)} aria-label="A month later" className="step">
              ›
            </button>
          </div>
          {!away ? (
            <span className="label">{touch ? "drag the ruler" : "scroll the dial"}</span>
          ) : (
            <span className="flex items-center gap-2">
              <button type="button" onClick={today} className="label reset-link">
                Reset to today
              </button>
              {/* Written the way a menu writes its shortcuts, because that is
                  what these are. Nothing to show a phone, which has no keys. */}
              {!touch && (
                <span className="flex items-center gap-1">
                  <kbd className="key">R</kbd>
                  <span className="joiner">or</span>
                  <kbd className="key">T</kbd>
                </span>
              )}
            </span>
          )}
        </header>

        {/* Size containment turns the leftover height into a unit the square can
            be built from: the largest square that fits, centred in what is left.
            Sizing it off the height alone left it hanging from the top of a
            phone screen, where the space is far taller than it is wide. */}
        <div
          className="flex-1 min-h-0 w-full flex items-center justify-center"
          style={{ containerType: "size" }}
          onPointerDown={takeOver}
        >
          <div style={{ width: "min(100%, 100cqh)", aspectRatio: "1 / 1" }}>
            <OrreryDial
              planets={planets}
              maxWidth={1400}
              wheelScrub={false}
            />
          </div>
        </div>

        {/* Just a ruler. The bars that used to live here said the same thing
            the dial says, one scroll away, and took a third of the cover to say
            it. */}
        <div className="w-full max-w-[54rem] shrink-0 select-none flex flex-col items-center gap-1">
          <div
            ref={track}
            className="relative h-9 w-full cursor-ew-resize touch-none"
            onPointerDown={(e) => {
              takeOver();
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
        </div>
      </div>
    </div>
  );
}
