import { Body, MakeTime, HelioVector, Ecliptic } from "astronomy-engine";

/**
 * The same bodies as helio.ts, in three dimensions. helio.ts flattens every
 * position onto the ecliptic, which is what the dial draws and what the angles
 * are measured in; this file keeps the height above and below it, so the tilted
 * view can show that the orbits do not share one plane.
 *
 * Nothing here feeds the relations. It only draws.
 */
export const BODIES_3D = [
  { name: "Mercury", body: Body.Mercury, periodDays: 87.969 },
  { name: "Venus", body: Body.Venus, periodDays: 224.701 },
  { name: "Earth", body: Body.Earth, periodDays: 365.256 },
  { name: "Mars", body: Body.Mars, periodDays: 686.98 },
  { name: "Jupiter", body: Body.Jupiter, periodDays: 4332.59 },
  { name: "Saturn", body: Body.Saturn, periodDays: 10759.22 },
  { name: "Uranus", body: Body.Uranus, periodDays: 30688.5 },
  { name: "Neptune", body: Body.Neptune, periodDays: 60182 },
  { name: "Pluto", body: Body.Pluto, periodDays: 90560 },
] as const;

export type Vec3 = [number, number, number];

/** Heliocentric ecliptic position in AU: x toward 0°, y toward 90°, z north of the ecliptic. */
export function eclipticVec(body: Body, date: Date): Vec3 {
  const v = Ecliptic(HelioVector(body, MakeTime(date))).vec;
  return [v.x, v.y, v.z];
}

/**
 * Distances run 0.31 AU (Mercury at perihelion) to 49 AU (Pluto at aphelion). At
 * true scale the inner four vanish into the Sun, so the radius is compressed
 * logarithmically, the way the dial does it. Only the length of each vector
 * changes: its direction is kept, which means every longitude and every tilt
 * above the ecliptic is exact. What bends is the shape of an ellipse, which
 * stays visibly an ellipse.
 */
const AU_MIN = 0.3;
const AU_MAX = 50;
export const SCENE_R_MIN = 1.1;
export const SCENE_R_MAX = 10;

export function compress([x, y, z]: Vec3): Vec3 {
  const r = Math.hypot(x, y, z);
  if (!r) return [0, 0, 0];
  const k = (Math.log(r) - Math.log(AU_MIN)) / (Math.log(AU_MAX) - Math.log(AU_MIN));
  const s = (SCENE_R_MIN + k * (SCENE_R_MAX - SCENE_R_MIN)) / r;
  return [x * s, y * s, z * s];
}

/** One full revolution sampled from the ephemeris, so the drawn path is the real
    orbit, ellipse and tilt included, not a circle. Centred on the given date. */
export function orbitPath(body: Body, periodDays: number, around: Date, samples = 160): Vec3[] {
  const out: Vec3[] = [];
  const t0 = around.getTime() - (periodDays / 2) * 86400000;
  for (let i = 0; i <= samples; i++) {
    const d = new Date(t0 + (i / samples) * periodDays * 86400000);
    out.push(compress(eclipticVec(body, d)));
  }
  return out;
}
