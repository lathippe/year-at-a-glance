import { computeTransits, orbProfile, peakOfWindow } from "./astrology";
import type { Aspect } from "./astrology";

export type RibbonBar = {
  key: string;
  label: string;
  /** English name of the transiting body, for the colour lookup. */
  bodyName: string;
  /** What the engine says this transit does. */
  meaning: string;
  aspectName: string;
  symbol: string;
  strength: number;
  /** Milliseconds; null means the orb window runs past the scan. */
  from: number | null;
  to: number | null;
  /** Moment of tightest orb inside the window, not the midpoint of it. */
  peak: number;
  /**
   * How tight the aspect is along the bar, 0..1, sampled across exactly the
   * span the bar is drawn over. The bar is painted from this, so its brightest
   * stretch is the stretch when the transit is actually strongest instead of
   * one flat colour end to end.
   */
  profile: number[];
};

/**
 * Mars and everything slower. The Sun, Mercury and Venus hold an aspect for
 * about a week, which at half-year width is three pixels; they belong in the
 * fast-transit strip, not here. Mars keeps an aspect for a couple of weeks, so
 * it draws a real bar and its conjunctions are among the strongest things that
 * happen all year.
 */
const SLOW = ["Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
/** Ten days: Mars windows run about twelve, so nothing of its is stepped over. */
const STEP_DAYS = 10;
const DAY = 86400000;

/**
 * Every slow transit whose orb window touches the span around `centre`, as bars
 * on a time axis. Scanned rather than solved: computeTransits answers for one
 * instant, so the span is sampled every twenty days and the windows it reports
 * are merged by key.
 */
/** Scanning half a year takes seconds, and the answer only changes once a day.
    Keyed by that day, so a warm instance serves the ribbon instantly. */
const cache = new Map<string, RibbonBar[]>();

export function transitRibbon(centre: Date, spanDays: number): RibbonBar[] {
  const key = `${centre.toISOString().slice(0, 10)}-${spanDays}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bars = scanRibbon(centre, spanDays);
  cache.set(key, bars);
  return bars;
}

function scanRibbon(centre: Date, spanDays: number): RibbonBar[] {
  const seen = new Map<string, RibbonBar>();
  const spanFrom = centre.getTime() - spanDays * DAY;
  const spanTo = centre.getTime() + spanDays * DAY;
  for (let d = -spanDays; d <= spanDays; d += STEP_DAYS) {
    const at = new Date(centre.getTime() + d * DAY);
    for (const t of computeTransits(at) as Aspect[]) {
      if (!SLOW.includes(t.transit.body.name)) continue;
      const key = `${t.transit.body.name}-${t.aspect.name}-${t.natal.body.name}`;
      const from = t.entersOrb ? t.entersOrb.getTime() : null;
      const to = t.exitsOrb ? t.exitsOrb.getTime() : null;
      const prev = seen.get(key);
      // Strength depends on how tight the orb is at the moment asked, so a
      // transit first met at the edge of its window scored low and fell out of
      // the ranking. Keep the highest reading across the scan: that is the
      // transit at its peak, which is what "strongest" should mean.
      if (prev) {
        if (t.strength > prev.strength) prev.strength = t.strength;
        continue;
      }
      // Sampled over the drawn extent, not the true window: a transit whose orb
      // opens before the scan starts is cut off on screen, and a profile
      // measured over the full window would put its bright part off the bar.
      const drawnFrom = Math.max(from ?? spanFrom, spanFrom);
      const drawnTo = Math.min(to ?? spanTo, spanTo);
      seen.set(key, {
        key,
        bodyName: t.transit.body.name,
        meaning: t.meaning,
        // The second body is hers, not the sky's. Without the marker the row
        // read as two transiting planets aspecting each other.
        label: `${t.transit.body.glyph} ${t.transit.body.nameRu} ${t.aspect.symbol} ${t.natal.body.glyph} ${t.natal.body.nameRu} нат.`,
        aspectName: t.aspect.name,
        symbol: t.aspect.symbol,
        strength: t.strength,
        from,
        to,
        peak: peakOfWindow(
          t.transit.body.name,
          t.natal.longitude,
          t.aspect.angle,
          drawnFrom,
          drawnTo
        ),
        profile: orbProfile(
          t.transit.body.name,
          t.natal.longitude,
          t.aspect.angle,
          drawnFrom,
          drawnTo
        ),
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.strength - a.strength);
}
