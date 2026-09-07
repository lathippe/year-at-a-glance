import { Body, HelioVector, MakeTime, RotateVector, Rotation_EQJ_ECL } from "astronomy-engine";

/**
 * Orbital periods measured from the ephemeris, and the near-integer ratios
 * between them. Nothing here is typed in from a table: each period is the mean
 * motion of the body's heliocentric longitude, fitted by least squares over a
 * long span and turned into days per revolution.
 *
 * The longitude is taken in the J2000 ecliptic, a frame fixed to the stars.
 * Measured against the equinox of the date instead, every period comes out
 * short by the precession rate (0.6% for Neptune, 0.9% for Pluto), because the
 * zero point drifts to meet the planet. Sidereal is the period the resonances
 * are about.
 */

const BODIES = [
  Body.Mercury,
  Body.Venus,
  Body.Earth,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
  Body.Uranus,
  Body.Neptune,
  Body.Pluto,
] as const;

/**
 * Fit window, in revolutions of the body, centred on the year 2000. Pluto's
 * longitude swings slowly in its resonance with Neptune, and a window of two
 * or three revolutions gives a period that moves by a percent with the window
 * chosen; twelve or more settles it. Sixty is the cap so Mercury does not run
 * to tens of thousands of samples for no gain.
 */
export const FIT_CENTRE_YEAR = 2000;
export const MIN_ORBITS = 12;
const MAX_ORBITS = 60;
/** About a millennium of window for the middle planets, fewer revolutions for
    the slow ones, more for the fast ones. */
const TARGET_SPAN_YEARS = 1000;
const SAMPLES_PER_ORBIT = 24;

/** A ratio counts as simple when the terms are small and the fit is tight in
    proportion to them: 2:1 may be off by 3%, 13:8 only by 0.29%. One rule, two
    constants, no list of favourites. */
export const MAX_TERM = 13;
export const RATIO_TOLERANCE = 0.06;

const DAY = 86400000;
const ROT = Rotation_EQJ_ECL();

function siderealLongitude(body: Body, ms: number): number {
  const v = RotateVector(ROT, HelioVector(body, MakeTime(new Date(ms))));
  return (((Math.atan2(v.y, v.x) * 180) / Math.PI) % 360 + 360) % 360;
}

/** Days per revolution, from the slope of unwrapped longitude against time. */
function meanPeriodDays(body: Body): number {
  const centre = Date.UTC(FIT_CENTRE_YEAR, 0, 1);
  // Step from the body's own speed, so the unwrap never has to guess which way
  // round a gap of more than half a turn went.
  const lc = siderealLongitude(body, centre);
  const lc1 = siderealLongitude(body, centre + 10 * DAY);
  const degPerDay = ((((lc1 - lc) % 360) + 360) % 360) / 10;
  const roughPeriod = (360 / degPerDay) * DAY;
  const orbits = Math.min(
    MAX_ORBITS,
    Math.max(MIN_ORBITS, Math.round((TARGET_SPAN_YEARS * 365.25 * DAY) / roughPeriod))
  );
  const step = roughPeriod / SAMPLES_PER_ORBIT;
  const t0 = centre - (roughPeriod * orbits) / 2;
  const t1 = centre + (roughPeriod * orbits) / 2;
  const l0 = siderealLongitude(body, t0);

  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  let prev = l0, acc = l0;
  for (let t = t0; t <= t1; t += step) {
    const l = siderealLongitude(body, t);
    let d = l - prev;
    if (d < -180) d += 360;
    if (d > 180) d -= 360;
    acc += d;
    prev = l;
    const x = (t - t0) / DAY;
    n++; sx += x; sy += acc; sxx += x * x; sxy += x * acc;
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return 360 / slope;
}

export type Period = { name: string; days: number };
export type Ratio = {
  /** The longer period first, so the ratio reads ≥ 1. */
  a: string;
  b: string;
  p: number;
  q: number;
  actual: number;
  /** (actual − p/q) / (p/q), signed. */
  deviation: number;
  aDays: number;
  bDays: number;
};

let cached: Period[] | null = null;

/** Measured once per process; the answer does not change. */
export function siderealPeriods(): Period[] {
  if (cached) return cached;
  cached = BODIES.map((b) => ({ name: String(b), days: meanPeriodDays(b) }));
  return cached;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The simplest fraction the ratio qualifies for, or null. Smallest terms win,
    since the tolerance already tightens as they grow. */
function simpleFraction(r: number): { p: number; q: number; deviation: number } | null {
  let best: { p: number; q: number; deviation: number } | null = null;
  for (let q = 1; q <= MAX_TERM; q++) {
    for (let p = q; p <= MAX_TERM; p++) {
      if (gcd(p, q) !== 1) continue;
      const ideal = p / q;
      const deviation = (r - ideal) / ideal;
      if (Math.abs(deviation) > RATIO_TOLERANCE / (p + q)) continue;
      if (!best || p + q < best.p + best.q) best = { p, q, deviation };
    }
  }
  return best;
}

/** Every pair whose periods stand in a simple ratio, tightest first. */
export function simpleRatios(periods: Period[] = siderealPeriods()): Ratio[] {
  const out: Ratio[] = [];
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const [slow, fast] =
        periods[i].days >= periods[j].days ? [periods[i], periods[j]] : [periods[j], periods[i]];
      const actual = slow.days / fast.days;
      const f = simpleFraction(actual);
      if (f)
        out.push({
          a: slow.name,
          b: fast.name,
          p: f.p,
          q: f.q,
          actual,
          deviation: f.deviation,
          aDays: slow.days,
          bDays: fast.days,
        });
    }
  }
  return out.sort((x, y) => Math.abs(x.deviation) - Math.abs(y.deviation));
}
