"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { HelioPos } from "@/lib/helio";
import { useIsDark } from "@/lib/useIsDark";
import { useSelectedDate } from "@/lib/selectedDate";
import { blendHex, mixHex, planetTone, rimFor } from "@/lib/planetTones";

const SIZE = 460;
const C = SIZE / 2;
// The disc is 230 across the radius and a body's glow reaches some eight px past
// its ring, so Neptune at 212 fills the circle without touching the edge.
const R_INNER = 54; // Mercury
const R_OUTER = 198; // Pluto, pulled in to leave the rim breathing room

// Distances run 0.39 AU to 30 AU. Linear, Mercury through Mars collapse onto the
// Sun; logarithmic, every orbit gets a readable gap. The dial trades true scale
// for legibility on purpose — the angles are exact, the radii are not.
/**
 * Paper spacing. The log scale still bunches Neptune, Uranus and Saturn against
 * the rim while leaving a canyon between Mars and Jupiter, so the day dial
 * interpolates between hand-set anchors instead: near-even rings. The radius
 * there means order, not distance; the angles stay exact either way.
 */
const DAY_ANCHORS: [number, number][] = [
  [0.387, 0], // Mercury
  [0.723, 0.1], // Venus
  [1.0, 0.27], // Earth
  [1.524, 0.4], // Mars
  [5.203, 0.54], // Jupiter
  [9.537, 0.66], // Saturn
  [19.19, 0.78], // Uranus
  [30.07, 0.9], // Neptune
  // Pluto's distance inside the window. Over its orbit it runs 30 to 49 AU, and
  // past the last anchor the fraction clamps at 1, so the ring stays the rim.
  [35.7, 1], // Pluto
];

/** Night keeps the logarithmic spacing, with one hand adjustment: Venus pulled
    in toward Mercury, which the pure log leaves oddly far out. */
const NIGHT_ANCHORS: [number, number][] = [
  [0.387, 0], // Mercury
  [0.723, 0.09], // Venus, log would put it at 0.135
  [1.0, 0.2], // Earth
  [1.524, 0.29], // Mars
  [5.203, 0.55], // Jupiter
  [9.537, 0.68], // Saturn
  [19.19, 0.82], // Uranus
  [30.07, 0.92], // Neptune
  [35.7, 1], // Pluto, see the day table
];

function anchorFraction(au: number, pts: [number, number][]): number {
  const l = Math.log10(au);
  if (l <= Math.log10(pts[0][0])) return 0;
  for (let i = 1; i < pts.length; i++) {
    const l0 = Math.log10(pts[i - 1][0]);
    const l1 = Math.log10(pts[i][0]);
    if (l <= l1) {
      const t = (l - l0) / (l1 - l0);
      return pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]);
    }
  }
  return 1;
}

/**
 * How present a ring is allowed to be, by how close it runs to the edge of the
 * disc. At full strength the outermost orbit doubled as a frame around the
 * drawing; gone entirely it took the edge of the picture with it. A floor rather
 * than zero answers both, and the rings now fade out instead of stopping.
 */
function ringFade(r: number): number {
  const k = (R_OUTER - r) / (R_OUTER - R_INNER);
  return Math.max(0.16, Math.min(1, k / 0.22));
}

function radiusFor(au: number, night = true): number {
  const k = anchorFraction(au, night ? NIGHT_ANCHORS : DAY_ANCHORS);
  // Quantised for the same reason as pointAt: this radius is written straight
  // into an r attribute, and the two engines' Math.pow can differ in the last bit.
  const r = R_INNER + Math.max(0, Math.min(1, k)) * (R_OUTER - R_INNER);
  return Math.round(r * 1000) / 1000;
}

/** Longitude zero at three o'clock, running counterclockwise — the way the
    bodies go round, not the way SVG counts. */
function pointAt(lonDeg: number, r: number) {
  const a = (lonDeg * Math.PI) / 180;
  // Rounded, and not for tidiness. Math.sin and Math.cos are not required to be
  // correctly rounded, and Node and Chrome disagree on the last bit of some
  // results — so the server writes 292.2915736888562 into an SVG attribute and
  // the browser computes ...85626, and React reports a hydration mismatch over a
  // difference no screen can hold. Three decimals of a 700-unit viewBox is far
  // below a pixel and puts both engines on the same number.
  const q = (v: number) => Math.round(v * 1000) / 1000;
  return { x: q(C + r * Math.cos(a)), y: q(C - r * Math.sin(a)) };
}

/** Solar Walk's tail: the stretch of orbit a planet has just come through,
    brightest at the body and gone by its far end. Planets run counterclockwise,
    so the tail sits at lower longitudes.

    Length carries speed. A flat 40-day sweep would run 164° for Mercury and a
    quarter of a degree for Neptune, so the raw sweep is compressed by a power
    law: the order stays honest (Mercury longest, Neptune shortest) and the slow
    outer planets still get a visible tail. One path, not a row of chords —
    chords bead where their round caps overlap. */
const TRAIL_WINDOW_DAYS = 40;
const TRAIL_MIN_DEG = 12;
const TRAIL_SPAN_DEG = 66;
/** Paper runs them a quarter longer: on white a short tail reads as a smudge. */
const TRAIL_DAY_STRETCH = 1.25;
const TRAIL_REF_SWEEP = 164; // Mercury over the window, the fastest thing here

/** 0 for the slowest body here, 1 for the fastest. It sets how far the tail
    reaches, and only that: it used to set the stroke width as well, which made
    speed read twice and the second reading said importance instead. */
function speedFactor(degPerDay: number): number {
  const swept = degPerDay * TRAIL_WINDOW_DAYS;
  // Rounded like pointAt and radiusFor: this feeds a stroke width and a trail
  // length straight into the markup, and ** 0.4 is another operation the two
  // engines round differently in the last bit.
  const k = Math.min(1, Math.max(0, swept / TRAIL_REF_SWEEP)) ** 0.4;
  return Math.round(k * 1e6) / 1e6;
}

function trailDegrees(degPerDay: number, night: boolean): number {
  const base = TRAIL_MIN_DEG + speedFactor(degPerDay) * TRAIL_SPAN_DEG;
  return night ? base : base * TRAIL_DAY_STRETCH;
}

function trailPath(lon: number, r: number, deg: number): string {
  const steps = 40;
  const pts = Array.from({ length: steps + 1 }, (_, i) =>
    pointAt(lon - deg + (deg * i) / steps, r)
  );
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

/** The simple fractions of a circle. Measured between geocentric longitudes:
    the angle is the one seen from Earth, not from the Sun. Zero is listed as a
    fraction too, since two bodies at the same longitude are the limiting case
    of the same idea. */
const RELATIONS = [
  { key: "same", label: "coincidence", angle: 0 },
  { key: "sixth", label: "1/6", angle: 60 },
  { key: "quarter", label: "1/4", angle: 90 },
  { key: "third", label: "1/3", angle: 120 },
  { key: "half", label: "1/2", angle: 180 },
] as const;
type RelationDef = (typeof RELATIONS)[number];
/** How far off a fraction a pair may stand and still be drawn. A rendering
    cutoff for legibility, nothing more: past it the line would be too faint to
    read. Every threshold in this file is this one. */
const RELATION_CUTOFF_DEG = 6;

/**
 * How nearness becomes ink. The one place the continuous encoding lives, so it
 * can be swapped by eye without touching the drawing. Nearness runs 0 at the
 * cutoff to 1 exact; the curve is bent so the last degree counts for more than
 * the first, which is how the eye already weighs "nearly" against "roughly".
 * Pointing at a line or a body lifts the whole range but keeps its order.
 */
const RELATION_STYLE = {
  gamma: 1.5,
  opacity: [0.12, 0.8] as const,
  width: [0.3, 0.75] as const,
  hotOpacity: [0.5, 1] as const,
  hotWidth: [0.5, 1.05] as const,
  glow: 0.35,
  glowWidth: 2.4,
};
function relationStroke(nearness: number, hot: boolean) {
  const k = Math.pow(Math.min(1, Math.max(0, nearness)), RELATION_STYLE.gamma);
  const lerp = (r: readonly [number, number]) => r[0] + (r[1] - r[0]) * k;
  const opacity = lerp(hot ? RELATION_STYLE.hotOpacity : RELATION_STYLE.opacity);
  const width = lerp(hot ? RELATION_STYLE.hotWidth : RELATION_STYLE.width);
  return {
    opacity,
    width,
    glowOpacity: opacity * RELATION_STYLE.glow,
    glowWidth: width * RELATION_STYLE.glowWidth,
  };
}

/** "1/4 − 2.3°": the fraction and how far the pair stands from it, signed.
    Short of the fraction is negative. Exact to a tenth is written as exact. */
function deviationLabel(rel: RelationDef, deviation: number): string {
  if (Math.abs(deviation) < 0.05) return `${rel.label} exact`;
  const sign = deviation < 0 ? "−" : "+";
  return `${rel.label} ${sign} ${Math.abs(deviation).toFixed(1)}°`;
}

/** The neutral ink: coincidences, sixths, and anything without a hue of its
    own. A step darker on paper because a thin line on white needs more weight
    than the same line on black. */
const RELATION_INK = { day: "#3f4650", night: "#d5dbe6" };

/**
 * Hue says which fraction, and only that. Three hues, because three is what
 * validates all-pairs for colour-blind readers in both skies (the fourth hue
 * collides with one of these under deutan or protan vision in the dark, and
 * the reference palette stops at three for the same reason). The sixth, the
 * finest division drawn, wears the neutral ink like the coincidence. Violet
 * rather than blue so a line is never in Earth's colour. Both sets pass the
 * six checks against #f4f3f0 and #080a12 with every pair above 3:1.
 */
// Chroma held near 0.13 in OKLCH: the saturated steps read as a horoscope's
// coloured lines; these read as ink. The third is a yellow-green rather than
// an aqua, and the quarter a brick red rather than an orange: yellow-green
// against orange collapses under deutan vision (ΔE 2.5 to 5), so the warm
// hue moved to red and dropped in lightness. Worst pair now ΔE 11.6 on paper
// and 15.5 in the dark, every hue above 3:1 on its surface.
const RELATION_HUE: Partial<Record<RelationDef["key"], { day: string; night: string }>> = {
  half: { day: "#555095", night: "#8e87d2" },
  third: { day: "#58994a", night: "#65a556" },
  quarter: { day: "#a03e46", night: "#a03e46" },
};
function relationInk(rel: RelationDef, night: boolean): string {
  const h = RELATION_HUE[rel.key];
  return h ? (night ? h.night : h.day) : night ? RELATION_INK.night : RELATION_INK.day;
}

const MOON_OFFSET = 8.2;

/** Thickness of a planet's outline on the paper sky. Grown inward from a fixed
    outer edge, so a heavier ring never makes the body take more room. */
const RING_WIDTH = 2;
/** The grey every daytime trail starts from, before a third of the body's
    own colour is mixed in. */
const TRAIL_DAY = "#8d8780";

/** Where a body sits on the dial. The Moon has no solar orbit worth drawing, so
    it is pinned beside Earth in its true geocentric direction: the distance is a
    fixed twelve pixels, the bearing is real. */
function dialPoint(
  p: HelioPos,
  earth: HelioPos | undefined,
  night: boolean
): { x: number; y: number } {
  // The Sun is the middle of this drawing, so its end of any chord is the middle.
  if (p.name === "Sun") return { x: C, y: C };
  if (p.isMoon && earth) {
    const e = pointAt(earth.lon, radiusFor(earth.au, night));
    const a = (p.lon * Math.PI) / 180;
    return { x: e.x + MOON_OFFSET * Math.cos(a), y: e.y - MOON_OFFSET * Math.sin(a) };
  }
  return pointAt(p.lon, radiusFor(p.au, night));
}

/** One tint per body in both skies. At night it fills the disc, lit from inside.
    On paper the same tint is worn as an outline, matching the planet's own trail,
    so a body and its path read as one object instead of a grey dot parked on a
    coloured line. */
function bodyInk(p: HelioPos, night: boolean): string {
  if (p.isEarth) return "var(--accent)";
  // On paper the Moon shares Earth's colour, so the pair reads as one system.
  // At night it goes white: a lit moon against black is what the eye expects,
  // and the knockout ring already keeps it off Earth's disc.
  // A lighter shade of Earth's blue: same family, read apart at a glance.
  if (p.isMoon) return night ? "#ffffff" : "#7cb2dc";
  return p.tone;
}

type RelationHit = { rel: RelationDef; label: string; deviation: number; nearness: number };

/** How near a pair stands to the fraction, 1 exact, 0 at the cutoff. The only
    thing that ranks a relation: no kind of angle outranks another. */
function nearnessOf(deviation: number): number {
  return 1 - Math.abs(deviation) / RELATION_CUTOFF_DEG;
}

/** Every relation a body stands in, nearest first. Nothing is dropped: the
    deviation on each row says how loose it is. */
function relationsOf(p: HelioPos, sky: Relation[]): RelationHit[] {
  const inSky: RelationHit[] = [];
  for (const r of sky) {
    const other = r.a.nameRu === p.nameRu ? r.b : r.b.nameRu === p.nameRu ? r.a : null;
    if (!other) continue;
    inSky.push({ rel: r.rel, label: other.nameRu, deviation: r.deviation, nearness: r.nearness });
  }
  return inSky.sort((a, b) => b.nearness - a.nearness).slice(0, 6);
}

/** Distance from a point to a segment. The relation lines carry no marker, so
    the line itself has to be the hit area. */
function distToSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

type Relation = {
  a: HelioPos;
  b: HelioPos;
  rel: RelationDef;
  /** The angle actually measured between the two, 0..180. */
  angle: number;
  /** Measured minus exact, degrees. Negative is short of the fraction. */
  deviation: number;
  /** 1 exact, 0 at the cutoff. */
  nearness: number;
};

/**
 * Where the angle is measured from. From the Sun it is the angle between the
 * bodies' heliocentric longitudes, which is exactly what the dial draws: the
 * arc and the number agree, Earth is a body like the rest and the Sun, being
 * the vertex, is not one. From Earth it is the angle an observer here sees,
 * between geocentric longitudes; the Sun joins as a body and Earth drops out,
 * and the arc on the heliocentric dial no longer shows the angle it labels.
 */
export type Frame = "sun" | "earth";

function findRelations(planets: HelioPos[], frame: Frame): Relation[] {
  // The Moon has no heliocentric longitude of its own worth an angle; it stays
  // in the Earth frame only.
  const bodies =
    frame === "sun"
      ? planets.filter((p) => !p.isMoon && p.name !== "Sun")
      : planets.filter((p) => !p.isEarth && p.geoLon != null);
  const lonOf = (p: HelioPos) => (frame === "sun" ? p.lon : p.geoLon!);
  const out: Relation[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const d = angularDiff(lonOf(bodies[i]), lonOf(bodies[j]));
      for (const rel of RELATIONS) {
        const deviation = d - rel.angle;
        if (Math.abs(deviation) <= RELATION_CUTOFF_DEG)
          out.push({
            a: bodies[i],
            b: bodies[j],
            rel,
            angle: d,
            deviation,
            nearness: nearnessOf(deviation),
          });
      }
    }
  }
  return out;
}

/** Seeded so the sky is identical on the server and in the browser, and does not
    reshuffle on every hover. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The sky is thinned inside the orbits: a star sitting between Mars and
    Jupiter competes with the bodies for the same glance. Most of the field is
    dropped inside R_OUTER and what survives there is dimmed, so density grows
    outward and the moving points own the middle. */
const STARS = (() => {
  const rnd = mulberry32(20260904);
  const out: {
    x: number; y: number; r: number; o: number;
    warm: boolean; twinkle: boolean; delay: number; dur: number;
  }[] = [];
  for (let i = 0; i < 320 && out.length < 130; i++) {
    const x = rnd() * SIZE;
    const y = rnd() * SIZE;
    const bright = rnd();
    const keepRoll = rnd();
    const twinkle = rnd() > 0.12;
    const delay = rnd() * 6;
    const dur = 3 + rnd() * 4;
    const inField = Math.hypot(x - C, y - C) < R_OUTER + 12;
    if (inField && keepRoll > 0.3) continue;
    out.push({
      x,
      y,
      r: 0.22 + bright * bright * 0.6,
      o: (0.1 + bright * 0.58) * (inField ? 0.5 : 1),
      warm: rnd() > 0.86,
      twinkle,
      delay,
      dur,
    });
  }
  return out;
})();

/** The belt in the reference shot: a scatter, not a ring, between Mars and
    Jupiter (about 2.1 to 3.3 AU). */
const BELT = (() => {
  const rnd = mulberry32(31415926);
  const rMin = radiusFor(2.1);
  const rMax = radiusFor(3.3);
  return Array.from({ length: 220 }, () => {
    const a = rnd() * Math.PI * 2;
    const r = rMin + rnd() * (rMax - rMin);
    return {
      x: C + r * Math.cos(a),
      y: C - r * Math.sin(a),
      s: 0.35 + rnd() * 0.5,
      o: 0.18 + rnd() * 0.45,
      // Slower and more staggered than the star field: the belt should read as
      // dust catching the light, not as a second constellation blinking at you.
      delay: rnd() * 9,
      dur: 5 + rnd() * 6,
    };
  });
})();

/** The page is in English; the engine names things in Russian. One map here
    rather than a second set of names threaded through the ephemeris. */
const EN: Record<string, string> = {
  "Солнце": "Sun", "Луна": "Moon", "Меркурий": "Mercury", "Венера": "Venus",
  "Земля": "Earth", "Марс": "Mars", "Юпитер": "Jupiter", "Сатурн": "Saturn",
  "Уран": "Uranus", "Нептун": "Neptune", "Плутон": "Pluto",
};
/** The engine names everything in Russian, so every string on its way to the
    screen goes through here. Renaming the ephemeris for the sake of one English
    page would be the tail wagging the dog; leaving a single call out is how
    "Меркурий" ends up under an English heading. */
const en = (s: string) => EN[s] ?? s;

/** A body's colour as an actual value. `p.tone` is a CSS variable — good for a
    fill, useless for arithmetic: mixHex and blendHex hand back anything that is
    not a hex, so a gradient built from p.tone comes out as the same flat colour
    at every stop, which is exactly what happened. Anything that computes a
    colour goes through here first. */
function toneHex(name: string, night: boolean): string {
  return planetTone(name, night);
}

/** Two skies. Night is the Solar Walk field: deep space, stars, bodies in the
    dark-theme tints. Day is the same dial on paper — no stars, darker tints,
    heavier orbits, because a thin colour line on white needs more weight than
    the same line on black. Both force their own tones, so a dial does not
    change palette when the dashboard theme flips. */
export type OrreryVariant = "night" | "day" | "auto";

/** Built from the one palette in lib/planetTones, so nothing showing a planet
    can drift from the dial. Earth is the exception: on the dial it
    wears the accent, because it is where you are standing. */
const toneVars = (night: boolean): CSSProperties =>
  ({
    "--planet-mercury": planetTone("Mercury", night),
    "--planet-venus": planetTone("Venus", night),
    "--planet-mars": planetTone("Mars", night),
    "--planet-jupiter": planetTone("Jupiter", night),
    "--planet-saturn": planetTone("Saturn", night),
    "--planet-uranus": planetTone("Uranus", night),
    "--planet-neptune": planetTone("Neptune", night),
    "--planet-pluto": planetTone("Pluto", night),
    "--accent": planetTone("Earth", night),
  }) as CSSProperties;

export function OrreryDial({
  planets,
  maxWidth = SIZE,
  variant = "auto",
  wheelScrub = true,
  lit = [],
  frame = "sun",
}: {
  planets: HelioPos[];
  /** The dial is drawn at 460 and scales down; inside a column it wants a cap. */
  maxWidth?: number;
  /** "auto" follows the dashboard theme; the two named skies pin it. */
  variant?: OrreryVariant;
  /** Off when the page owns the wheel itself, so the gesture works beside the
      dial as well as over it and nothing counts a scroll twice. */
  wheelScrub?: boolean;
  /** English names of bodies the page wants lifted. Their orbits come forward
      and everyone else steps back, so a pair named elsewhere on the page can
      be found on the dial without hunting. */
  lit?: string[];
  /** Vertex of every angle: the Sun, matching the drawing, or Earth. */
  frame?: Frame;
}) {
  const isDark = useIsDark();
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Where a finger came down. A tap is judged on the way up, so a drag that
  // starts on a planet scrubs the date instead of pinning the planet.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const night = variant === "auto" ? isDark : variant === "night";
  /** Relation lines are a layer, off until asked for: click the Sun for all of
      them, or a planet for its own. On first sight the dial should be the sky,
      not a web of chords. The Sun is the switch. */
  const [relationsVisible, setRelationsVisible] = useState(false);

  // The Sun has no place in a heliocentric list — it is the middle — so it was
  // missing from the web entirely, and the angles it makes are among the ones
  // that matter most. Seen from Earth it stands exactly opposite Earth's own
  // heliocentric longitude, which is all the engine needs. Added for the
  // relations only, never drawn as a planet.
  const sunBody = (() => {
    const e = planets.find((p) => p.isEarth);
    if (!e) return null;
    return {
      ...e,
      name: "Sun",
      nameRu: "Солнце",
      tone: planetTone("Sun", night),
      isEarth: false,
      isMoon: false,
      au: 0,
      lon: 0,
      geoLon: ((e.lon + 180) % 360 + 360) % 360,
    } as HelioPos;
  })();

  const skyRelations = findRelations(
    frame === "earth" && sunBody ? [...planets, sunBody] : planets,
    frame
  );

  /**
   * Whether a relation gets a line. The Moon laps the circle in a month and
   * Mercury never leaves the Sun's side, so their coincidences are almost
   * always on and crowd out the angles that are actually news. They keep their
   * place in the cards — the fact is true and worth reading — they just stop
   * being drawn.
   */
  const drawn = (r: Relation) =>
    !(
      frame === "earth" &&
      r.rel.key === "same" &&
      (r.a.isMoon || r.b.isMoon || r.a.name === "Mercury" || r.b.name === "Mercury")
    );
  // Endpoints of a relation: the two bodies where they stand.
  const relationEnds = (r: { a: HelioPos; b: HelioPos }) =>
    [dialPoint(r.a, earthPos, night), dialPoint(r.b, earthPos, night)] as const;

  // Two dials can share a page, and SVG ids are global to the document.
  const uid = variant === "auto" ? (night ? "auto-night" : "auto-day") : variant;
  const [hover, setHover] = useState<string | null>(null);
  // Once the dial has been touched it stops behaving like a pointer surface:
  // there is no hover to follow, so the card belongs to whatever is pinned.
  const [touchMode, setTouchMode] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  // Pinning a planet narrows the layer to that body's own relations; with
  // nothing pinned the whole web is drawn. The Sun switches the layer off.
  const pinnedPlanet =
    pinned && !pinned.startsWith("rel:") && planets.some((p) => p.nameRu === pinned)
      ? pinned
      : null;
  const hoveredBody =
    hover && !hover.startsWith("rel:") ? hover : null;
  const relations = relationsVisible
    ? pinnedPlanet
      ? skyRelations.filter((r) => r.a.nameRu === pinnedPlanet || r.b.nameRu === pinnedPlanet)
      : skyRelations
    : // The layer is off by default, which meant hovering a planet lit nothing:
      // there were no chords in the drawing to light. Hovering now reveals that
      // one body's relations for as long as the pointer stays. Clicking keeps them.
    hoveredBody
    ? skyRelations.filter((r) => r.a.nameRu === hoveredBody || r.b.nameRu === hoveredBody)
    : [];

  const litSet = lit.length ? new Set(lit) : null;

  // Scrolling over the dial walks the calendar, a day at a time, unless a body
  // is being read: then the wheel belongs to the page again. State is mirrored
  // into refs so the listener is attached once instead of on every pointer move.
  const { selected, setSelected } = useSelectedDate();
  const wheelState = useRef({ selected });
  useEffect(() => {
    wheelState.current = { selected };
  }, [selected]);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !wheelScrub) return;
    let acc = 0;
    const STEP = 36; // wheel pixels per day
    const onWheel = (e: WheelEvent) => {
      const { selected: day } = wheelState.current;
      e.preventDefault();
      acc += e.deltaY;
      const days = Math.trunc(acc / STEP);
      if (!days) return;
      acc -= days * STEP;
      setSelected(new Date(day.getTime() + days * 86400000));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setSelected, wheelScrub]);
  // Hover reads, click keeps. Nothing on the dial is labelled, so the card is
  // the only name: it has to survive the pointer leaving.
  // Two different jobs. `shown` drives the lit state on the dial and survives a
  // click, because that is what a pin is for. The card follows the pointer only:
  // a click changes which relations are drawn, and taking the mouse away puts the
  // card back, pinned or not.
  // Per-body enter/leave dropped events: the bodies are two pixels wide, they
  // sit under a mask, and a fast exit could leave the card pinned to a planet the
  // pointer had already left. One picker for the whole svg, called by move and
  // by down, so the state cannot get stuck and a tap is not a second code path.
  const pickAt = (e: { clientX: number; clientY: number; pointerType: string }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return null;
    const scale = SIZE / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    // Each target is scored against its own reach, so a fat planet target and a
    // thin chord compete fairly and the nearer one wins. A fingertip covers
    // about ten millimetres and cannot be aimed the way a cursor can, so touch
    // gets a much wider reach; only the distance at which something counts as
    // near changes, never who beats whom.
    const touch = e.pointerType !== "mouse";
    const reach = touch ? 38 : 20;
    // Twenty, not seven: the line is bowed away from the chord it is scored
    // against, so on a narrow reach you aim at the visible arc and miss the
    // invisible straight line underneath.
    const chordReach = touch ? 30 : 20;
    let best: string | null = null;
    let bestScore = 1;
    for (const p of planets) {
      // Earth is where you are standing, not something to inspect.
      if (p.isEarth) continue;
      const pt = dialPoint(p, earthPos, night);
      const score = Math.hypot(pt.x - x, pt.y - y) / reach;
      if (score < bestScore) {
        bestScore = score;
        best = p.nameRu;
      }
    }
    // The Sun sits at the centre and is hovered like any other body, but it has
    // no card: it is the one thing on the dial that never needed naming.
    const dSun = Math.hypot(C - x, C - y);
    const sunScore = dSun / (touch ? 34 : 22);
    if (sunScore < bestScore) {
      bestScore = sunScore;
      best = "Солнце";
    }
    // A body under the pointer wins outright. Every line starts at a body, so
    // at the body itself the line and the body were the same distance away and
    // the pick alternated between them from one move to the next: the card
    // flipped, the layer flipped with it, and the planet flickered.
    if (best) return best;
    relations.forEach((r, i) => {
      if (!drawn(r)) return;
      const [pa, pb] = relationEnds(r);
      // The stretch of line inside either body's own reach belongs to the body.
      if (Math.hypot(pa.x - x, pa.y - y) < reach || Math.hypot(pb.x - x, pb.y - y) < reach) return;
      const score = distToSegment(x, y, pa.x, pa.y, pb.x, pb.y) / chordReach;
      if (score < bestScore) {
        bestScore = score;
        best = `rel:${i}`;
      }
    });
    return best;
  };

  const shown = hover ?? pinned;
  const cardKey = touchMode ? shown : hover;

  const active = planets.find((p) => p.nameRu === cardKey) ?? null;
  const activeRelation = cardKey?.startsWith("rel:")
    ? relations[Number(cardKey.slice(4))] ?? null
    : null;
  const earthPos = planets.find((p) => p.isEarth);
  const activePt = active ? dialPoint(active, earthPos, night) : null;

  return (
    <div className="relative w-full" style={{ maxWidth, ...toneVars(night) }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          width: "100%",
          display: "block",
          cursor: hover ? "pointer" : "default",
          // The dial keeps the gesture: a tap on a two-pixel planet must not be
          // read as the start of a page scroll. It does mean the page cannot be
          // scrolled by dragging across the dial.
          touchAction: "none",
        }}
        // Per-body enter/leave dropped events: the bodies are two pixels wide,
        // they sit under a mask, and a fast exit could leave the card pinned to
        // a planet the pointer had already left. One handler on the svg picks the
        // nearest body to the pointer, so the state cannot get stuck.
        onPointerMove={(e) => setHover(pickAt(e))}
        // A tap is not a hover. On touch, pointermove only fires while a finger
        // is dragging, so nothing was ever hovered and the click that followed
        // had no target: the planets were simply dead. Touch does its whole job
        // here, in one gesture, and marks the dial so the card can stay put
        // afterwards instead of vanishing with the finger.
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          touchStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") return;
          const st = touchStart.current;
          touchStart.current = null;
          // Moved more than a fingertip's wobble: that was a drag, and the page
          // has already spent it on the date.
          if (!st || Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) return;
          setTouchMode(true);
          const hit = pickAt(e);
          setHover(hit);
          if (hit && !hit.startsWith("rel:"))
            setRelationsVisible(true);
          else if (!hit) setRelationsVisible(false);
          setPinned((s) => (hit ? (s === hit ? null : hit) : null));
        }}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
        onClick={(e) => {
          // The touch path already ran on pointerdown; letting the synthetic
          // click through would undo the pin it just set.
          if ((e.nativeEvent as PointerEvent).pointerType !== "mouse" && touchMode) return;
          // Clicking a body shows its relations, even if the layer was switched off
          // at the Sun a moment ago. Clicking nothing puts the layer away: the
          // bodies are four pixels wide, so a miss is the common way to be done
          // with a reading, and it used to leave every thread on screen with
          // nothing selected. The Sun stops propagation, so its own switch is
          // not caught by this.
          if (hover && !hover.startsWith("rel:"))
            setRelationsVisible(true);
          else if (!hover) setRelationsVisible(false);
          setPinned((s) => (hover ? (s === hover ? null : hover) : null));
        }}
      >
        <defs>
          <radialGradient id={`field-${uid}`} cx="50%" cy="50%" r="72%">
            {night ? (
              /* Flat, not graded: the night field should read as a solid disc of
                 space out to its edge. */
              <>
                <stop offset="0%" stopColor="#080a12" />
                <stop offset="100%" stopColor="#080a12" />
              </>
            ) : (
              /* Plain white paper. All the warmth in this sky belongs to the
                 sun's own haze, so the field carries none of it. */
              <>
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="65%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0.85} />
              </>
            )}
          </radialGradient>
          <radialGradient id={`sun-corona-${uid}`} cx="50%" cy="50%" r="50%">
            {night ? (
              <>
                <stop offset="0%" stopColor="#fff3c4" stopOpacity={0.9} />
                <stop offset="35%" stopColor="#f0a04b" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#c8541e" stopOpacity={0} />
              </>
            ) : (
              /* Five stops instead of three: on white a three-stop falloff shows
                 its middle stop as a ring. */
              <>
                <stop offset="0%" stopColor="#ffe9b8" stopOpacity={0.46} />
                <stop offset="22%" stopColor="#ffdf9a" stopOpacity={0.35} />
                <stop offset="45%" stopColor="#ffcd72" stopOpacity={0.22} />
                <stop offset="70%" stopColor="#ffbc57" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#f9b04a" stopOpacity={0} />
              </>
            )}
          </radialGradient>
          {!night && (
            <radialGradient id={`sun-inner-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff0c2" stopOpacity={0.6} />
              <stop offset="40%" stopColor="#ffd071" stopOpacity={0.34} />
              <stop offset="100%" stopColor="#ffb63f" stopOpacity={0} />
            </radialGradient>
          )}
          <filter id={`body-glow-${uid}`} x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          {/* A wider, softer blur for the lift. The body's own glow is tight by
              design; reusing it for a halo three times the radius gave a hard
              bright disc instead of light. */}
          {/* Light around the filament, not a second brighter filament. */}
          <filter id={`relation-glow-${uid}`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          <filter id={`lift-glow-${uid}`} x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          {/* A gradient alone still has a mathematically crisp falloff. Blurring
              the corona on top of it is what makes the light read as haze. */}
          <filter id={`sun-haze-${uid}`} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          {/* Soft rim. Everything inside the dial is masked by this: opaque out
              to the last orbit, then dissolving to nothing, so the field melts
              into the panel instead of ending on a cut edge. */}
          <radialGradient id={`fade-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
            <stop offset="42%" stopColor="#ffffff" stopOpacity={1} />
            <stop offset="72%" stopColor="#ffffff" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
          {/* Built like a glass marble, which is four things and not one.
              The body runs from a lit tint up and left down to a dark far limb.
              A bounce rides the far rim: the light that has gone past the stone,
              hit the surface under it and come back up, which is the whole reason
              a glass bead looks lit from inside instead of painted. A broad soft
              sheen sits over the top, wide and low-contrast rather than a hot dot,
              because a small hard highlight makes plastic. And no outline at all:
              a ring around a shaded sphere flattens it straight back to a sticker.
              At twelve pixels every one of these is about two pixels of work, and
              all four are needed for any of it to read. */}
          {!night &&
            planets.map((p) => {
              const hex = toneHex(p.name, night);
              return (
              <radialGradient
                key={`sphere-${p.name}`}
                id={`sphere-${p.name}-${uid}`}
                cx="50%"
                cy="50%"
                r="80%"
                fx="32%"
                fy="26%"
              >
                <stop offset="0%" stopColor={mixHex(hex, "white", 0.68)} />
                <stop offset="26%" stopColor={mixHex(hex, "white", 0.2)} />
                <stop offset="58%" stopColor={hex} />
                <stop offset="84%" stopColor={mixHex(hex, "black", 0.42)} />
                <stop offset="100%" stopColor={mixHex(hex, "black", 0.66)} />
              </radialGradient>
              );
            })}
          {!night &&
            planets.map((p) => {
              const hex = toneHex(p.name, night);
              return (
              <radialGradient
                key={`limb-${p.name}`}
                id={`limb-${p.name}-${uid}`}
                /* 78%, and the number is not a taste call. These gradients are
                   struck from the light rather than the centre, so the far edge
                   of the disc sits at |offset| + r_circle = 0.272 + 0.5 = 0.772
                   of the box. Any radius above that and the last stops fall
                   outside the shape and never paint — which is exactly what the
                   first version of this bounce did. */
                cx="34%"
                cy="28%"
                r="78%"
              >
                <stop offset="58%" stopColor={mixHex(hex, "black", 0.72)} stopOpacity={0} />
                <stop offset="80%" stopColor={mixHex(hex, "black", 0.72)} stopOpacity={0.3} />
                <stop offset="92%" stopColor={mixHex(hex, "black", 0.72)} stopOpacity={0.5} />
                <stop offset="100%" stopColor={mixHex(hex, "black", 0.72)} stopOpacity={0.34} />
              </radialGradient>
              );
            })}
          {/* Bands, for the two bodies that have them to show. At this size they
              do not resolve as stripes so much as give the disc a grain, which is
              what tells a gas giant from a painted marble. */}
          {!night &&
            planets
              .filter((p) => p.name === "Jupiter" || p.name === "Saturn")
              .map((p) => {
                const hex = toneHex(p.name, night);
                return (
                <linearGradient
                  key={`bands-${p.name}`}
                  id={`bands-${p.name}-${uid}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={mixHex(hex, "black", 0.22)} />
                  <stop offset="18%" stopColor={mixHex(hex, "white", 0.3)} />
                  <stop offset="34%" stopColor={mixHex(hex, "black", 0.24)} />
                  <stop offset="52%" stopColor={mixHex(hex, "white", 0.34)} />
                  <stop offset="68%" stopColor={mixHex(hex, "black", 0.2)} />
                  <stop offset="84%" stopColor={mixHex(hex, "white", 0.22)} />
                  <stop offset="100%" stopColor={mixHex(hex, "black", 0.26)} />
                </linearGradient>
                );
              })}
          {!night &&
            planets.map((p) => {
              const hex = toneHex(p.name, night);
              return (
              <radialGradient
                key={`bounce-${p.name}`}
                id={`bounce-${p.name}-${uid}`}
                cx="34%"
                cy="28%"
                r="78%"
              >
                <stop offset="90%" stopColor={mixHex(hex, "white", 0.78)} stopOpacity={0} />
                <stop offset="97%" stopColor={mixHex(hex, "white", 0.78)} stopOpacity={0.6} />
                <stop offset="100%" stopColor={mixHex(hex, "white", 0.9)} stopOpacity={0.92} />
              </radialGradient>
              );
            })}
          {!night && (
            <radialGradient id={`spec-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.92} />
              <stop offset="38%" stopColor="#ffffff" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
            </radialGradient>
          )}
          <mask id={`field-mask-${uid}`}>
            <circle cx={C} cy={C} r={SIZE / 2} fill={`url(#fade-${uid})`} />
          </mask>
        </defs>

        {/* No field is painted. Both of them used to fill in exactly the colour
            the panel already carries — #ffffff by day, #080a12 at night, the same
            values as --surface-space — so neither ever showed. What they did do
            was give the two skies different silhouettes: night was a rounded
            rectangle across the whole box, day a disc with a soft rim. Switching
            themes morphed a square into a circle, and no amount of timing or
            cross-fading can make that read as anything but a jolt. With the
            fields gone the two skies are the same shape, and the switch is a
            change of colour plus the stars. */}
        <g mask={night ? undefined : `url(#field-mask-${uid})`}>

        {night &&
          STARS.map((s, i) => (
            <circle
              key={`star-${i}`}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={s.warm ? "#ffd9b0" : "#ffffff"}
              opacity={s.o}
              style={
                s.twinkle
                  ? ({
                      "--o": s.o,
                      animation: `star-twinkle ${s.dur.toFixed(1)}s ease-in-out ${s.delay.toFixed(1)}s infinite`,
                    } as CSSProperties)
                  : undefined
              }
            />
          ))}

        {night && BELT.map((b, i) => (
          <circle
            key={`belt-${i}`}
            cx={b.x}
            cy={b.y}
            r={b.s}
            fill={night ? "#cfc6b8" : "#97a3bb"}
            opacity={night ? b.o : b.o * 0.95}
            style={
              {
                "--o": night ? b.o : b.o * 0.95,
                animation: `star-twinkle ${b.dur.toFixed(1)}s ease-in-out ${b.delay.toFixed(1)}s infinite`,
              } as CSSProperties
            }
          />
        ))}

        </g>

        {/* Full orbit, thin and in the body's own colour — the faint ring the
            tail below runs along. */}
        {planets
          .filter((p) => !p.isMoon)
          .map((p) => (
          <circle
            key={`orbit-${p.nameRu}`}
            cx={C}
            cy={C}
            r={radiusFor(p.au, night)}
            fill="none"
            stroke={p.tone}
            strokeWidth={0.7}
            // One lit state, whatever asked for it: pointing at the body or
            // naming it from the page brings the orbit forward the same amount.
            // The separation comes from the others stepping back.
            opacity={
              (shown === p.nameRu || litSet?.has(p.name)
                ? night
                  ? 0.3
                  : 0.28
                : night
                ? 0.13
                : 0.09) * ringFade(radiusFor(p.au, night))
            }
            style={{ transition: "opacity 120ms" }}
          />
          ))}

        {(() => {
            const earth = planets.find((p) => p.isEarth);
            if (!earth) return null;
            // Bodies standing in a drawn relation get their name under them.
            const named = new Set<string>();
            for (const r of relations) if (drawn(r)) { named.add(r.a.nameRu); named.add(r.b.nameRu); }
            return (
              <g>
                {planets
                  .filter((p) => !p.isEarth)
                  .map((p) => {
                    const pt = dialPoint(p, earth, night);
                    // Below the body for most. On the two outer orbits a name
                    // below runs out of the box, so it sits beside the body
                    // instead, on the side that faces the centre.
                    const outer = radiusFor(p.au, night) > R_OUTER - 30;
                    const side = outer ? (pt.x >= C ? -1 : 1) : 0;
                    return (
                      <g key={`name-${p.nameRu}`}>
                        {/* Only the bodies actually in a relation are named, and
                            quietly: the point is to read the pair, not to label
                            the sky. */}
                        {named.has(p.nameRu) && !p.isMoon && (
                          <text
                            x={pt.x + side * 9}
                            y={outer ? pt.y + 3.5 : pt.y + 13}
                            textAnchor={side === 0 ? "middle" : side < 0 ? "end" : "start"}
                            fill="var(--muted)"
                            // Full ink on paper: at three quarters the grey fell
                            // to 3.3:1, under the line for ten-pixel text.
                            opacity={night ? 0.8 : 1}
                            style={{ fontSize: 8.5, letterSpacing: "0.01em" }}
                          >
                            {en(p.nameRu)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                {relations.map((r, i) => {
                  if (!drawn(r)) return null;
                  // Pointing at a body lights everything it reaches, not just
                  // the one line under the cursor. "What is this planet standing
                  // in relation to" was the commonest question the web could not
                  // answer without tracing lines by eye.
                  const hot =
                    shown === `rel:${i}` ||
                    shown === r.a.nameRu ||
                    shown === r.b.nameRu;
                  const [pa, pb] = relationEnds(r);
                  const mx = (pa.x + pb.x) / 2;
                  const my = (pa.y + pb.y) / 2;
                  // Bowed away from the middle of the dial, so three of them can
                  // never close the triangle three straight chords would.
                  const bx = mx + (mx - C) * 0.16;
                  const by = my + (my - C) * 0.16;
                  const arc = `M${pa.x} ${pa.y} Q${bx} ${by} ${pb.x} ${pb.y}`;
                  // One ink. How near the pair stands to the fraction is the
                  // line's weight and opacity, continuously: a pair two degrees
                  // short of a quarter is a fainter line than one a tenth short,
                  // and nothing is either on or off. The mapping lives in
                  // relationStroke.
                  const ink = relationInk(r.rel, night);
                  const st = relationStroke(r.nearness, hot);
                  return (
                    <g key={`rel-${i}`} style={{ transition: "opacity 120ms" }}>
                      <path
                        d={arc}
                        fill="none"
                        stroke={ink}
                        strokeWidth={st.glowWidth}
                        strokeLinecap="round"
                        filter={`url(#relation-glow-${uid})`}
                        opacity={st.glowOpacity}
                      />
                      <path
                        d={arc}
                        fill="none"
                        stroke={ink}
                        strokeWidth={st.width}
                        strokeLinecap="round"
                        opacity={st.opacity}
                      />
                      {/* The fraction, written along the line the way a drawing
                          carries a dimension: 1/3, 1/6, 1/2, at the arc's
                          midpoint a few pixels to the outer side, turned to run
                          with the line and kept upright. It fades with the
                          line. A hairline halo in the sky's colour keeps it
                          legible where lines cross. A coincidence needs no
                          label: the two bodies stand together. */}
                      {r.rel.angle > 0 && (() => {
                        const gx = 0.25 * pa.x + 0.5 * bx + 0.25 * pb.x;
                        const gy = 0.25 * pa.y + 0.5 * by + 0.25 * pb.y;
                        const nl = Math.hypot(gx - C, gy - C) || 1;
                        const off = 5.5;
                        const lx = gx + ((gx - C) / nl) * off;
                        const ly = gy + ((gy - C) / nl) * off;
                        let ang = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
                        if (ang > 90) ang -= 180;
                        if (ang < -90) ang += 180;
                        return (
                          <text
                            x={lx}
                            y={ly}
                            transform={`rotate(${ang.toFixed(1)} ${lx} ${ly})`}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={ink}
                            stroke={night ? "#080a12" : "#f4f3f0"}
                            strokeWidth={2}
                            opacity={Math.min(1, st.opacity + 0.15)}
                            pointerEvents="none"
                            style={{
                              fontSize: 7,
                              fontFamily: "var(--font-mono), ui-monospace, monospace",
                              letterSpacing: "0.02em",
                              paintOrder: "stroke",
                            }}
                          >
                            {r.rel.label}
                          </text>
                        );
                      })()}
                    </g>
                  );
                })}
              </g>
            );
          })()}

        {/* On paper the corona breathes: eleven seconds out and back, a few
            percent of size and a little opacity. Slow enough that you catch it
            only if you rest on it, which is the difference between a star and a
            loading spinner. The night sky is left alone — it has the stars
            twinkling already, and two things pulsing is a fairground. */}
        <circle
          cx={C}
          cy={C}
          r={night ? 34 : 26}
          fill={`url(#sun-corona-${uid})`}
          filter={night ? undefined : `url(#sun-haze-${uid})`}
          style={
            night
              ? undefined
              : ({ transformOrigin: `${C}px ${C}px`, animation: "sun-breathe 11s ease-in-out infinite" } as CSSProperties)
          }
        />
        {/* A second, tighter glow on a different period. One pulsing circle reads
            as a mechanism; two that drift in and out of step read as something
            burning, because the peaks never land in the same place twice. */}
        {!night && (
          <circle
            cx={C}
            cy={C}
            r={11}
            fill={`url(#sun-inner-${uid})`}
            filter={`url(#sun-haze-${uid})`}
            style={{
              transformOrigin: `${C}px ${C}px`,
              animation: "sun-pulse 7s ease-in-out infinite",
            }}
          />
        )}
        <circle
          cx={C}
          cy={C}
          r={night ? 4.5 : 4.4}
          fill={night ? "#fff6d5" : "#f8c53c"}
          filter={`url(#body-glow-${uid})`}
          opacity={night || relationsVisible ? 1 : 0.45}
        />
        {/* On paper the body is solid yellow with no hot centre: a pale dot
            inside it read as a hole, not as heat. */}
        <circle cx={C} cy={C} r={night ? 2.8 : 3.4} fill={night ? "#ffffff" : "#f5b81d"} />
        {/* The Sun is the switch for the relation layer. Nothing else on the
            dial is a control, and it sits where a legend would have gone. */}
        <circle
            cx={C}
            cy={C}
            r={14}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setRelationsVisible((v) => !v);
            }}
          >
            <title>{relationsVisible ? "Hide relations" : "Show relations"}</title>
          </circle>

        {planets.map((p, gi) => {
          const r = radiusFor(p.au, night);
          const pt = dialPoint(p, earthPos, night);
          // A body lights up when the pointer is on it, or when the page names
          // it. Naming a pair pushes everyone else back, so the pair reads as a
          // pair.
          const lifted = litSet?.has(p.name) ?? false;
          const isHover = shown === p.nameRu || lifted;
          const dimmed = litSet != null && !lifted;
          const deg = trailDegrees(p.degPerDay, night);
          const tailStart = pointAt(p.lon - deg, r);
          const gid = `trail-grad-${uid}-${gi}`;
          return (
            <g
              key={p.nameRu}
              opacity={dimmed ? 0.22 : 1}
              style={{ transition: "opacity 120ms" }}
            >
              <defs>
                <linearGradient
                  id={gid}
                  gradientUnits="userSpaceOnUse"
                  x1={tailStart.x}
                  y1={tailStart.y}
                  x2={pt.x}
                  y2={pt.y}
                >
                  {/* Mostly grey on paper, a third of the way to the body's own
                      colour. A full-strength tint puts a second pale cream stroke
                      on parchment and Venus loses its path altogether; flat grey
                      cuts the path loose from the planet it belongs to. A third
                      is enough to tell whose trail it is without the trail
                      competing for the identity the disc already carries. */}
                  <stop offset="0%" stopColor={night ? p.tone : blendHex(TRAIL_DAY, toneHex(p.name, night), 0.34)} stopOpacity={0} />
                  <stop offset="55%" stopColor={night ? p.tone : blendHex(TRAIL_DAY, toneHex(p.name, night), 0.34)} stopOpacity={isHover ? (night ? 0.55 : 0.58) : night ? 0.3 : 0.36} />
                  <stop offset="100%" stopColor={night ? p.tone : blendHex(TRAIL_DAY, toneHex(p.name, night), 0.34)} stopOpacity={isHover ? 1 : night ? 0.85 : 0.8} />
                </linearGradient>
              </defs>
              {!p.isMoon && (
              <path
                d={trailPath(p.lon, r, deg)}
                fill="none"
                stroke={`url(#${gid})`}
                // One width for every body. Thickness was reading as importance —
                // Mercury's trail was twice Neptune's — when the thing it stood
                // for was speed, which the length already says, and says better:
                // a long tail is a fast planet whichever way you look at it.
                strokeWidth={1.15}
                strokeLinecap="round"
              />
              )}
              {/* Two ways to draw a body. At night it is light on dark: a halo
                  in the planet's tint, the tint itself, a white spark. On paper
                  a filled dark dot reads as a hole punched in the page, so the
                  body is hollow instead — a ring around the page's own white,
                  which reads as a small luminary rather than a blot. */}
              {p.isMoon && lifted && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={6.5}
                  fill={bodyInk(p, night)}
                  filter={`url(#lift-glow-${uid})`}
                  opacity={0.6}
                />
              )}
              {p.isMoon ? (
                night ? (
                  /* At night it is simply a lit white point, like everything else
                     in that sky. Earth is blue there, so nothing has to be carved
                     out to tell them apart. */
                  <>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={2.2}
                      fill="#ffffff"
                      filter={`url(#body-glow-${uid})`}
                      opacity={0.7}
                    />
                    <circle cx={pt.x} cy={pt.y} r={1.1} fill="#ffffff" />
                  </>
                ) : (
                  /* Solid, in a lighter blue than Earth's ring. With Earth hollow
                     and the two set apart, no knockout or pinhole is needed to
                     tell them apart any more. */
                  /* Matte. Rock, not glass: a flat disc of its own grey with
                     one shadow along the far limb, no lit spot, no rim bounce,
                     no sheen. That is how the Moon looks to the eye and is not
                     how a marble looks. */
                  <>
                    <circle cx={pt.x} cy={pt.y} r={2.4} fill={toneHex(p.name, night)} />
                    <circle cx={pt.x} cy={pt.y} r={2.4} fill={`url(#limb-${p.name}-${uid})`} />
                  </>
                )
              ) : night ? (
                <>
                  {/* Named from the page: the same gold lift
                      the paper sky gives, so the answer to "which pair is this"
                      looks the same in both. */}
                  {lifted && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={8}
                      fill={bodyInk(p, night)}
                      filter={`url(#lift-glow-${uid})`}
                      opacity={0.5}
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={p.isMoon ? 2.4 : p.isEarth ? 4.6 : 4.2}
                    fill={bodyInk(p, night)}
                    filter={`url(#body-glow-${uid})`}
                    opacity={isHover ? 1 : 0.95}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={p.isMoon ? 1.3 : p.isEarth ? 3 : 2.6}
                    fill={bodyInk(p, night)}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={p.isEarth ? 0.9 : 0.75}
                    fill="#ffffff"
                    opacity={isHover ? 0.95 : 0.7}
                  />
                </>
              ) : (
                <>
                  {/* A halo in the body's own tint under the neutral ring: the
                      ring keeps colour out of the reading, the halo puts the
                      light back in. */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={lifted ? (p.isEarth ? 6.4 : 6.8) : p.isEarth ? 3.7 : 4.1}
                    // The lift is the body's own colour, only stronger. Gold said
                    // "selected" in a language nothing else on the dial speaks.
                    fill={p.tone}
                    filter={`url(#${lifted ? "lift" : "body"}-glow-${uid})`}
                    opacity={lifted ? 0.7 : isHover ? 0.42 : 0.26}
                  />
                  {/* Saturn's ring in two halves. The far half goes down here,
                      under the disc, so only its tips show past the limb; the
                      near half is drawn over the disc after the shading. Seen
                      a little from above, which is what tilts the ring. */}
                  {p.name === "Saturn" && (
                    <g transform={`translate(${pt.x} ${pt.y}) rotate(-16)`}>
                      <path
                        d="M -6.4 0 A 6.4 1.6 0 0 1 6.4 0"
                        fill="none"
                        stroke={rimFor(toneHex(p.name, night))}
                        strokeWidth={0.75}
                        opacity={isHover ? 0.95 : 0.8}
                      />
                    </g>
                  )}
                  {/* Lit, banded if it has bands, bounce on the far rim, sheen
                      over the top. The edge is where the shading runs out. */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={p.isEarth ? 3.2 : 3.7}
                    fill={`url(#sphere-${p.name}-${uid})`}
                    opacity={isHover ? 1 : 0.97}
                  />
                  {(p.name === "Jupiter" || p.name === "Saturn") && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={3.7}
                      fill={`url(#bands-${p.name}-${uid})`}
                      opacity={0.3}
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={p.isEarth ? 3.2 : 3.7}
                    fill={`url(#limb-${p.name}-${uid})`}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={p.isEarth ? 3.2 : 3.7}
                    fill={`url(#bounce-${p.name}-${uid})`}
                  />
                  <ellipse
                    cx={pt.x - (p.isEarth ? 0.85 : 1)}
                    cy={pt.y - (p.isEarth ? 1 : 1.15)}
                    rx={p.isEarth ? 1.15 : 1.32}
                    ry={p.isEarth ? 0.92 : 1.06}
                    transform={`rotate(-30 ${pt.x - (p.isEarth ? 0.85 : 1)} ${pt.y - (p.isEarth ? 1 : 1.15)})`}
                    fill={`url(#spec-${uid})`}
                  />
                  {/* The near half of Saturn's ring, in front of the disc. */}
                  {p.name === "Saturn" && (
                    <g transform={`translate(${pt.x} ${pt.y}) rotate(-16)`}>
                      <path
                        d="M -6.4 0 A 6.4 1.6 0 0 0 6.4 0"
                        fill="none"
                        stroke={rimFor(toneHex(p.name, night))}
                        strokeWidth={0.75}
                        opacity={isHover ? 0.95 : 0.8}
                      />
                    </g>
                  )}

                </>
              )}
            </g>
          );
        })}
      </svg>

      {activeRelation && (() => {
        const pa = dialPoint(activeRelation.a, earthPos, night);
        const pb = dialPoint(activeRelation.b, earthPos, night);
        const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
        return (
          <div
            className="absolute pointer-events-none rounded-md px-2.5 py-1.5"
            style={{
              left: `${(mid.x / SIZE) * 100}%`,
              top: `${(mid.y / SIZE) * 100}%`,
              transform: "translate(-50%, -170%)",
              background: night ? "rgba(8, 10, 16, 0.92)" : "var(--surface)",
              border: night ? "1px solid rgba(255, 255, 255, 0.16)" : "1px solid var(--border-strong)",
              width: 300,
            }}
          >
            <div className="text-sm font-medium" style={{ color: night ? "#ffffff" : "var(--foreground)" }}>
              {en(activeRelation.a.nameRu)} · {en(activeRelation.b.nameRu)}
            </div>
            <div className="text-[13px] tabular-nums mt-0.5 flex items-center gap-1.5" style={{ color: night ? "#ffffff" : "var(--foreground)" }}>
              <span
                aria-hidden
                style={{ width: 7, height: 7, borderRadius: 7, background: relationInk(activeRelation.rel, night), display: "inline-block" }}
              />
              {deviationLabel(activeRelation.rel, activeRelation.deviation)}
            </div>
            <div className="text-[11px] tabular-nums" style={{ color: night ? "rgba(255,255,255,0.6)" : "var(--muted)" }}>
              {frame === "sun" ? "from the Sun" : "from Earth"} · measured {activeRelation.angle.toFixed(1)}° · exact {activeRelation.rel.angle}°
            </div>
          </div>
        );
      })()}

      {active && activePt && (
        <div
          className="absolute pointer-events-none rounded-md px-2.5 py-1.5"
          style={{
            left: `${(activePt.x / SIZE) * 100}%`,
            top: `${(activePt.y / SIZE) * 100}%`,
            transform: "translate(-50%, -105%)",
            background: night ? "rgba(8, 10, 16, 0.92)" : "var(--surface)",
            border: night ? "1px solid rgba(255, 255, 255, 0.16)" : "1px solid var(--border-strong)",
            minWidth: 230,
          }}
        >
          {/* The name stays plain text; the tint goes on a dot, where it only
              says which body this is. */}
          <div
            className="text-sm font-medium flex items-center gap-1.5"
            style={{ color: night ? "#ffffff" : "var(--foreground)" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 7,
                background: active.tone,
                display: "inline-block",
              }}
            />
            {en(active.nameRu)}
          </div>
          <div className="text-[11px] tabular-nums" style={{ color: night ? "rgba(255,255,255,0.6)" : "var(--muted)" }}>
            {active.lon.toFixed(1)}° ·{" "}
            {active.isMoon
              ? `${Math.round((active.au * 149597870.7) / 1000)}k km`
              : `${active.au.toFixed(2)} AU`}{" "}
            · {active.degPerDay < 0.1 ? active.degPerDay.toFixed(3) : active.degPerDay.toFixed(2)}
            °/day
          </div>
          {(() => {
            const hits = relationsOf(active, skyRelations);
            if (hits.length === 0) return null;
            const dim = night ? "rgba(255,255,255,0.4)" : "var(--muted)";
            const ink = night ? "rgba(255,255,255,0.85)" : "var(--foreground)";
            return (
              <div className="mt-1.5 flex flex-col gap-0.5">
                <div className="text-[9px] uppercase tracking-wide" style={{ color: dim }}>
                  relations
                </div>
                {hits.map((h, i) => (
                  <div key={i} className="text-[11px] flex items-center gap-1.5 tabular-nums">
                    <span
                      aria-hidden
                      style={{ width: 6, height: 6, borderRadius: 6, background: relationInk(h.rel, night), display: "inline-block", flexShrink: 0 }}
                    />
                    <span style={{ color: ink, minWidth: 30 }}>{h.rel.angle === 0 ? "same" : h.rel.label}</span>
                    <span style={{ color: dim, minWidth: 30 }}>{h.rel.angle}°</span>
                    <span style={{ color: ink, minWidth: 44 }}>
                      {Math.abs(h.deviation) < 0.05 ? "exact" : `${h.deviation < 0 ? "−" : "+"}${Math.abs(h.deviation).toFixed(1)}°`}
                    </span>
                    <span style={{ color: ink }}>{en(h.label)}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
