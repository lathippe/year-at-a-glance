import { helioPositions } from "./helio";

/**
 * Aspects the planets make with each other, as windows on a time axis.
 *
 * The other ribbon in this codebase answers "what is the sky doing to your
 * chart" and needs a birth date to do it. This one has no person in it: it asks
 * only what the planets are doing to each other, which is the same question for
 * everybody and the only one a public chart can honestly answer.
 *
 * Scanned rather than solved. Exact ingress and egress would need a root find
 * per pair per aspect; sampling every few days and keeping the first and last
 * day in orb is accurate to the step, which at this width is a pixel or two.
 */
export type SkyBar = {
  key: string;
  label: string;
  aspect: string;
  symbol: string;
  /** −1 tension … +1 harmony, 0 conjunction. */
  valence: number;
  /** Tightest orb reached inside the window, in degrees. */
  bestOrb: number;
  from: number;
  to: number;
  /** Day the orb is tightest: the one worth putting in a calendar. */
  peak: number;
};

const ASPECTS = [
  { name: "conjunction", symbol: "☌", angle: 0, orb: 6, v: 0 },
  { name: "sextile", symbol: "⚹", angle: 60, orb: 4, v: 0.6 },
  { name: "square", symbol: "□", angle: 90, orb: 5, v: -0.6 },
  { name: "trine", symbol: "△", angle: 120, orb: 5, v: 1 },
  { name: "opposition", symbol: "☍", angle: 180, orb: 6, v: -1 },
] as const;

/** Fast movers make a new aspect every few weeks and would bury the slow ones. */
const SLOW = new Set(["Марс", "Юпитер", "Сатурн", "Уран", "Нептун"]);

const DAY = 86400000;
const STEP_DAYS = 2;

function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const cache = new Map<string, SkyBar[]>();

export function skyRibbon(centre: Date, spanDays: number): SkyBar[] {
  const key = `${centre.toISOString().slice(0, 10)}-${spanDays}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bars = scan(centre, spanDays);
  cache.set(key, bars);
  return bars;
}

function scan(centre: Date, spanDays: number): SkyBar[] {
  const open = new Map<string, SkyBar>();
  const done: SkyBar[] = [];

  for (let d = -spanDays; d <= spanDays; d += STEP_DAYS) {
    const at = new Date(centre.getTime() + d * DAY);
    const bodies = helioPositions(at).filter(
      (p) => !p.isEarth && p.geoLon != null && SLOW.has(p.nameRu),
    );
    const seenNow = new Set<string>();

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const sep = angularDiff(bodies[i].geoLon!, bodies[j].geoLon!);
        for (const a of ASPECTS) {
          const orb = Math.abs(sep - a.angle);
          if (orb > a.orb) continue;
          const k = `${bodies[i].nameRu}-${a.name}-${bodies[j].nameRu}`;
          seenNow.add(k);
          const cur = open.get(k);
          if (!cur) {
            open.set(k, {
              key: k,
              label: `${bodies[i].glyph} ${bodies[i].nameRu} ${a.symbol} ${bodies[j].glyph} ${bodies[j].nameRu}`,
              aspect: a.name,
              symbol: a.symbol,
              valence: a.v,
              bestOrb: orb,
              from: at.getTime(),
              to: at.getTime(),
              peak: at.getTime(),
            });
          } else {
            cur.to = at.getTime();
            if (orb < cur.bestOrb) {
              cur.bestOrb = orb;
              cur.peak = at.getTime();
            }
          }
        }
      }
    }
    // A pair that has left orb closes its window; a retrograde brings it back as
    // a new one, which is honest — it really is a second pass.
    for (const [k, bar] of open) {
      if (!seenNow.has(k)) {
        done.push(bar);
        open.delete(k);
      }
    }
  }
  done.push(...open.values());
  return done.sort((a, b) => a.bestOrb - b.bestOrb);
}
