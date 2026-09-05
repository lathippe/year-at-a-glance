"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { HelioPos } from "@/lib/helio";
import { helioPositions } from "@/lib/helio";
import { useIsDark } from "@/lib/useIsDark";
import { useSelectedDate } from "@/lib/selectedDate";
import { planetTone } from "@/lib/planetTones";
import {
  aspectTone,
  ASPECT_TONE_COLOR,
  readSkyAspect,
  NATAL,
  NATAL_CUSPS,
  computePositions,
  computeTransits,
  houseOfLongitude,
  toRoman,
  HOUSE_MEANING_RU,
  BODY_ROLE_RU,
  ZODIAC_GLYPHS,
  ZODIAC_SIGNS_RU,
} from "@/lib/astrology";

const SIZE = 460;
const C = SIZE / 2;
// The disc is 230 across the radius and a body's glow reaches some eight px past
// its ring, so Neptune at 212 fills the circle without touching the edge.
const R_INNER = 54; // Mercury
const R_OUTER = 198; // Neptune, pulled in to free a band for the zodiac

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
  [0.723, 0.11], // Venus
  [1.0, 0.3], // Earth
  [1.524, 0.45], // Mars
  [5.203, 0.6], // Jupiter
  [9.537, 0.73], // Saturn
  [19.19, 0.87], // Uranus
  [30.07, 1], // Neptune
];

/** Night keeps the logarithmic spacing, with one hand adjustment: Venus pulled
    in toward Mercury, which the pure log leaves oddly far out. */
const NIGHT_ANCHORS: [number, number][] = [
  [0.387, 0], // Mercury
  [0.723, 0.095], // Venus, log would put it at 0.144
  [1.0, 0.218], // Earth
  [1.524, 0.315], // Mars
  [5.203, 0.597], // Jupiter
  [9.537, 0.736], // Saturn
  [19.19, 0.897], // Uranus
  [30.07, 1], // Neptune
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
  return R_INNER + Math.max(0, Math.min(1, k)) * (R_OUTER - R_INNER);
}

/** 0° Aries at three o'clock, longitude running counterclockwise — the way a
    chart wheel turns, not the way SVG counts. */
function pointAt(lonDeg: number, r: number) {
  const a = (lonDeg * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
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

/** 0 for the slowest body here, 1 for the fastest. Drives both how far the tail
    reaches and how heavily it is drawn, so speed reads twice. */
function speedFactor(degPerDay: number): number {
  const swept = degPerDay * TRAIL_WINDOW_DAYS;
  return Math.min(1, Math.max(0, swept / TRAIL_REF_SWEEP)) ** 0.4;
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

/** Major aspects, the astrological ones. Measured between geocentric
    longitudes, because an aspect is an angle seen from Earth, not from the Sun. */
const ASPECTS = [
  { name: "conjunction", nameRu: "соединение", angle: 0, symbol: "☌" },
  { name: "sextile", nameRu: "секстиль", angle: 60, symbol: "⚹" },
  { name: "square", nameRu: "квадрат", angle: 90, symbol: "□" },
  { name: "trine", nameRu: "тригон", angle: 120, symbol: "△" },
  { name: "opposition", nameRu: "оппозиция", angle: 180, symbol: "☍" },
] as const;
const ASPECT_ORB = 6;

/** Where an aspect is drawn. "chord" joins the two bodies where they stand;
    "ring" joins their marks on a rim scaled in geocentric longitude, where the
    angle on screen really is the aspect angle. */
export type AspectMode = "chord" | "ring";
const R_RING = 224;

/**
 * The two rings are different kinds of thing and now say so. The zodiac is the
 * sky's own fixed grid, cool and impersonal; the houses are hers, warm. Both
 * stay muted: neither may compete with the planet tints, which carry meaning.
 */
/** Tension. Red rather than the burnt orange picked first for colour-blindness:
    on a black sky that orange read as gold, which is the colour of something
    good. Red scores better on both counts at once — against the turquoise of
    harmony 15.1 → 19.8 under deuteranopia, against the Sun's gold 15.1 → 26.4. */
const TENSION_INK = { day: "#b8392b", night: "#d24a3a" };

const ZODIAC_INK = { day: "#6f7b88", night: "#8b95a3" };
const HOUSE_INK = { day: "#8a7757", night: "#9c8f78" };

/** An aspect on the rim, drawn as the arc of rim it actually spans. The arc's
    own length is the angle: a trine covers a third of the circle, a square a
    quarter, and it can be read off without a label. Always the short way round,
    since an aspect is never wider than 180°. */
function rimArc(lonA: number, lonB: number, r: number) {
  const delta = ((lonB - lonA + 540) % 360) - 180; // -180..180
  const a = pointAt(lonA, r);
  const b = pointAt(lonB, r);
  // Longitude grows counterclockwise on screen, which is SVG's negative sweep.
  const sweep = delta > 0 ? 0 : 1;
  const steps = 24;
  const samples = Array.from({ length: steps + 1 }, (_, i) =>
    pointAt(lonA + (delta * i) / steps, r)
  );
  return { d: `M${a.x} ${a.y} A${r} ${r} 0 0 ${sweep} ${b.x} ${b.y}`, samples, span: Math.abs(delta) };
}

function distToPolyline(px: number, py: number, pts: { x: number; y: number }[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, distToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y));
  }
  return best;
}

const MOON_OFFSET = 8.2;

/** Thickness of a planet's outline on the paper sky. Grown inward from a fixed
    outer edge, so a heavier ring never makes the body take more room. */
const RING_WIDTH = 2;

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

/** Her natal chart, geocentric longitudes. Fixed data, so it is built once at
    module load rather than on every render. */
const NATAL_BODIES = computePositions(NATAL.date).map((p) => ({
  nameRu: p.body.nameRu,
  glyph: p.body.glyph,
  lon: p.longitude,
}));

type AspectHit = { symbol: string; tone: string; label: string; strength: number };

/** How much an aspect is worth saying out loud. Hard angles outrank soft ones,
    and a tight orb outranks a wide one. */
const ASPECT_WEIGHT: Record<string, number> = {
  conjunction: 1,
  opposition: 0.92,
  square: 0.86,
  trine: 0.78,
  sextile: 0.62,
};
const MIN_STRENGTH = 0.3;

function strengthOf(name: string, orb: number): number {
  return (ASPECT_WEIGHT[name] ?? 0.7) * (1 - orb / ASPECT_ORB);
}

/** Everything a body is in aspect to, split into what is happening in the sky
    and what is landing on her chart. Weak ones are dropped rather than listed:
    a six-degree sextile is noise. */
function aspectsOf(
  p: HelioPos,
  sky: { a: HelioPos; b: HelioPos; name: string; symbol: string; tone: string; orb: number }[]
): { inSky: AspectHit[]; toNatal: AspectHit[] } {
  const inSky: AspectHit[] = [];
  for (const asp of sky) {
    const other =
      asp.a.nameRu === p.nameRu ? asp.b : asp.b.nameRu === p.nameRu ? asp.a : null;
    if (!other) continue;
    inSky.push({
      symbol: asp.symbol,
      tone: asp.tone,
      label: other.nameRu,
      strength: strengthOf(asp.name, asp.orb),
    });
  }
  const toNatal: AspectHit[] = [];
  if (p.geoLon != null) {
    for (const n of NATAL_BODIES) {
      const d = angularDiff(p.geoLon, n.lon);
      for (const asp of ASPECTS) {
        const orb = Math.abs(d - asp.angle);
        if (orb <= ASPECT_ORB) {
          toNatal.push({
            symbol: asp.symbol,
            tone: ASPECT_TONE_COLOR[aspectTone(asp.name)],
            label: n.nameRu,
            strength: strengthOf(asp.name, orb),
          });
        }
      }
    }
  }
  const trim = (xs: AspectHit[]) =>
    xs.filter((x) => x.strength >= MIN_STRENGTH).sort((a, b) => b.strength - a.strength).slice(0, 5);
  return { inSky: trim(inSky), toNatal: trim(toNatal) };
}

/** Distance from a point to a segment. The aspect chords carry no marker any
    more, so the line itself has to be the hit area. */
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

function findAspects(planets: HelioPos[]) {
  const withGeo = planets.filter((p) => !p.isEarth && p.geoLon != null);
  const out: {
    a: HelioPos; b: HelioPos; name: string; symbol: string; nameRu: string; tone: string; orb: number;
  }[] = [];
  for (let i = 0; i < withGeo.length; i++) {
    for (let j = i + 1; j < withGeo.length; j++) {
      const d = angularDiff(withGeo[i].geoLon!, withGeo[j].geoLon!);
      for (const asp of ASPECTS) {
        const orb = Math.abs(d - asp.angle);
        if (orb <= ASPECT_ORB) {
          out.push({
            a: withGeo[i],
            b: withGeo[j],
            name: asp.name,
            symbol: asp.symbol,
            nameRu: asp.nameRu,
            tone: ASPECT_TONE_COLOR[aspectTone(asp.name)],
            orb,
          });
        }
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

const SIGNS = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"];

/** Two skies. Night is the Solar Walk field: deep space, stars, bodies in the
    dark-theme tints. Day is the same dial on paper — no stars, darker tints,
    heavier orbits, because a thin colour line on white needs more weight than
    the same line on black. Both force their own tones, so a dial does not
    change palette when the dashboard theme flips. */
export type OrreryVariant = "night" | "day" | "auto";

/** Built from the one palette in lib/planetTones, so the dial, the natal wheel
    and the ribbon cannot drift apart. Earth is the exception: on the dial it
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
    "--accent": planetTone("Earth", night),
  }) as CSSProperties;

export function OrreryDial({
  planets,
  maxWidth = SIZE,
  variant = "auto",
  aspectMode = "chord",
  personal = true,
}: {
  planets: HelioPos[];
  /** The dial is drawn at 460 and scales down; inside a column it wants a cap. */
  maxWidth?: number;
  /** "auto" follows the dashboard theme; the two named skies pin it. */
  variant?: OrreryVariant;
  aspectMode?: AspectMode;
  /**
   * With nobody attached the dial is a universal chart of the real sky: the
   * houses, the birth marks and every mention of a natal contact are gone, and
   * what is left is the planets and the angles they make with each other today.
   * The public showcase runs this way and ships no birth data at all.
   */
  personal?: boolean;
}) {
  const isDark = useIsDark();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const night = variant === "auto" ? isDark : variant === "night";
  /** Aspect lines are a layer, off until asked for: click the Sun for all of
      them, or a planet for its own. On first sight the dial should be the sky,
      not a web of chords. */
  // Off until asked for, on every chart. The dial should first read as the sky;
  // the aspects are a second layer over it and the Sun is the switch.
  const [aspectsVisible, setAspectsVisible] = useState(false);
  // Hoisted out of the layer below: the pointer handler needs the same list.
  // The sky at birth, computed once: it never changes, and it is the reference
  // the moving dial is read against.
  const natalPlanets = useMemo(() => helioPositions(NATAL.date), []);

  // The Sun has no place in a heliocentric list — it is the middle — so it was
  // missing from the aspect web entirely, and its aspects are among the ones
  // that matter most. Seen from Earth it stands exactly opposite Earth's own
  // heliocentric longitude, which is all the engine needs. Added for aspects
  // only, never drawn as a planet.
  const sunBody = (() => {
    const e = planets.find((p) => p.isEarth);
    if (!e) return null;
    return {
      ...e,
      name: "Sun",
      nameRu: "Солнце",
      glyph: "☉",
      tone: planetTone("Sun", night),
      isEarth: false,
      isMoon: false,
      au: 0,
      lon: 0,
      geoLon: ((e.lon + 180) % 360 + 360) % 360,
    } as HelioPos;
  })();

  const skyAspects = findAspects(sunBody ? [...planets, sunBody] : planets);

  /**
   * Whether an aspect gets a line. The Moon laps the zodiac in a month and
   * Mercury never leaves the Sun's side, so their conjunctions are almost always
   * on and crowd out the aspects that are actually news. They keep their place
   * in the cards — the fact is true and worth reading — they just stop being
   * drawn.
   */
  const drawn = (a: { name: string; a: HelioPos; b: HelioPos }) =>
    !(
      a.name === "conjunction" &&
      (a.a.isMoon || a.b.isMoon || a.a.name === "Mercury" || a.b.name === "Mercury")
    );
  // Drawn only on the paper sky; the card uses the full list in both.
  // Endpoints of an aspect: at the bodies themselves, or at their marks on the
  // geocentric rim.
  const aspectEnds = (asp: { a: HelioPos; b: HelioPos }) =>
    [dialPoint(asp.a, earthPos, night), dialPoint(asp.b, earthPos, night)] as const;
  // Two arcs on the very same radius would sit on top of each other where their
  // spans overlap, so they alternate between two rings three pixels apart.
  const arcRadius = (i: number) => R_RING - 5 - (i % 2) * 3.5;

  // Two dials can share a page, and SVG ids are global to the document.
  const uid = variant === "auto" ? (night ? "auto-night" : "auto-day") : variant;
  const [hover, setHover] = useState<string | null>(null);
  // Once the dial has been touched it stops behaving like a pointer surface:
  // there is no hover to follow, so the card belongs to whatever is pinned.
  const [touchMode, setTouchMode] = useState(false);
  const [pinned, setPinned] = useState<string | null>(null);
  // Pinning a planet narrows the layer to that body's own aspects; with nothing
  // pinned the whole web is drawn. The Sun switches the layer off entirely.
  const pinnedPlanet =
    pinned && !pinned.startsWith("asp:") && planets.some((p) => p.nameRu === pinned)
      ? pinned
      : null;
  const hoveredBody =
    hover && !hover.startsWith("asp:") && !hover.startsWith("natal:") ? hover : null;
  const aspects = aspectsVisible
    ? pinnedPlanet
      ? skyAspects.filter((a) => a.a.nameRu === pinnedPlanet || a.b.nameRu === pinnedPlanet)
      : skyAspects
    : // The layer is off by default, which meant hovering a planet lit nothing:
      // there were no chords in the drawing to light. Hovering now reveals that
      // one body's aspects for as long as the pointer stays. Clicking keeps them.
    hoveredBody
    ? skyAspects.filter((a) => a.a.nameRu === hoveredBody || a.b.nameRu === hoveredBody)
    : [];

  const [houseHover, setHouseHover] = useState<number | null>(null);
  const [signHover, setSignHover] = useState<number | null>(null);

  // Scrolling over the dial walks the calendar, a day at a time, unless a body
  // is being read: then the wheel belongs to the page again. State is mirrored
  // into refs so the listener is attached once instead of on every pointer move.
  const { selected, setSelected } = useSelectedDate();
  const wheelState = useRef({ hover, pinned, selected });
  useEffect(() => {
    wheelState.current = { hover, pinned, selected };
  }, [hover, pinned, selected]);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    let acc = 0;
    const STEP = 36; // wheel pixels per day
    const onWheel = (e: WheelEvent) => {
      const { hover: h, pinned: p, selected: day } = wheelState.current;
      if (h || p) return;
      e.preventDefault();
      acc += e.deltaY;
      const days = Math.trunc(acc / STEP);
      if (!days) return;
      acc -= days * STEP;
      setSelected(new Date(day.getTime() + days * 86400000));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setSelected]);
  // Hover reads, click keeps. Nothing on the dial is labelled, so the card is
  // the only name: it has to survive the pointer leaving.
  // Two different jobs. `shown` drives the lit state on the dial and survives a
  // click, because that is what a pin is for. The card follows the pointer only:
  // a click changes which aspects are drawn, and taking the mouse away puts the
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
    const chordReach = aspectMode === "ring" ? (touch ? 14 : 7) : touch ? 30 : 20;
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
    // Natal marks are small and sit on top of nothing, so they get their own
    // pass with a tighter reach than a live planet: they must never win a
    // contest against the body they are the memory of.
    for (const n of personal ? natalPlanets : []) {
      const liveBody = planets.find((q) => q.name === n.name);
      if (!liveBody || liveBody.isEarth || liveBody.isMoon) continue;
      const at = pointAt(n.lon, radiusFor(liveBody.au, night));
      const d = Math.hypot(at.x - x, at.y - y);
      // Right on top of the mark it wins outright. A live planet's reach is
      // nearly twice as wide, so on score alone a body fifteen pixels away beat
      // a ghost the pointer was sitting on, and the mark felt dead.
      if (d < (touch ? 14 : 7)) {
        bestScore = -1;
        best = `natal:${n.name}`;
        continue;
      }
      const score = d / (touch ? 30 : 16);
      if (score < bestScore) {
        bestScore = score;
        best = `natal:${n.name}`;
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
    aspects.forEach((asp, i) => {
      if (!drawn(asp)) return;
      let score: number;
      if (aspectMode === "ring") {
        const arc = rimArc(asp.a.geoLon!, asp.b.geoLon!, arcRadius(i));
        score = distToPolyline(x, y, arc.samples) / chordReach;
      } else {
        const [pa, pb] = aspectEnds(asp);
        score = distToSegment(x, y, pa.x, pa.y, pb.x, pb.y) / chordReach;
      }
      if (score < bestScore) {
        bestScore = score;
        best = `asp:${i}`;
      }
    });
    return best;
  };

  const shown = hover ?? pinned;
  const natalHot = shown?.startsWith("natal:") ? shown.slice(6) : null;
  const cardKey = touchMode ? shown : hover;
  const natalCard = cardKey?.startsWith("natal:") ? cardKey.slice(6) : null;
  // What today's sky is doing to that one natal point. Geocentric, like every
  // other aspect on the board: the dot's place on the dial is heliocentric, but
  // an aspect is an angle seen from Earth, and mixing the two would be a lie
  // dressed as a line. So nothing is drawn between them — the card says it.
  // Natal contacts are a personal reading; the universal chart has none.
  const natalHits =
    personal && natalCard
      ? computeTransits(selected).filter((t) => t.natal.body.name === natalCard)
      : [];


  const active = planets.find((p) => p.nameRu === cardKey) ?? null;
  const activeAspect = cardKey?.startsWith("asp:")
    ? aspects[Number(cardKey.slice(4))] ?? null
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
          // scrolled by dragging across the chart.
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
          setTouchMode(true);
          const hit = pickAt(e);
          setHover(hit);
          if (hit && !hit.startsWith("asp:") && !hit.startsWith("natal:"))
            setAspectsVisible(true);
          setPinned((s) => (hit ? (s === hit ? null : hit) : null));
        }}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
        onClick={(e) => {
          // The touch path already ran on pointerdown; letting the synthetic
          // click through would undo the pin it just set.
          if ((e.nativeEvent as PointerEvent).pointerType !== "mouse" && touchMode) return;
          // Clicking a body shows its aspects, even if the layer was switched off
          // at the Sun a moment ago.
          if (hover && !hover.startsWith("asp:") && !hover.startsWith("natal:"))
            setAspectsVisible(true);
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
                <stop offset="0%" stopColor="#ffe9b8" stopOpacity={0.34} />
                <stop offset="22%" stopColor="#ffdf9a" stopOpacity={0.26} />
                <stop offset="45%" stopColor="#ffd07a" stopOpacity={0.16} />
                <stop offset="70%" stopColor="#ffc061" stopOpacity={0.07} />
                <stop offset="100%" stopColor="#f9b04a" stopOpacity={0} />
              </>
            )}
          </radialGradient>
          <filter id={`body-glow-${uid}`} x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          {/* A wider, softer blur for the lift. The body's own glow is tight by
              design; reusing it for a halo three times the radius gave a hard
              bright disc instead of light. */}
          {/* Light around the filament, not a second brighter filament. */}
          <filter id={`aspect-glow-${uid}`} x="-200%" y="-200%" width="500%" height="500%">
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
            // One lit state, whatever asked for it: pointing at the body, at the
            // house it stands in, or at its sign all bring the orbit forward the
            // same amount. The separation comes from the others stepping back.
            opacity={
              (shown === p.nameRu ||
              (houseHover != null &&
                p.geoLon != null &&
                houseOfLongitude(p.geoLon) === houseHover) ||
              (signHover != null && p.signIdx === signHover)
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

        {/* Astrological sightlines, paper sky only. Thin grey lines from Earth
            to every planet; where two planets stand at a major angle from
            Earth, both their lines take that aspect's colour and a dashed chord
            with its symbol joins the pair. The angle drawn at Earth is not the
            aspect angle — radii on this dial are logarithmic — so the relation
            is named by colour and glyph instead of faked as geometry. */}
        {/* The twelve signs, on their own band inside the house numerals. Same
            deal as the houses: hovering one lights whoever is standing in it. */}
        <g>
          {ZODIAC_GLYPHS.map((glyph, i) => {
            const mid = pointAt(i * 30 + 15, R_RING - 22);
            const hot = signHover === i;
            // A sector with somebody in it today earns its ink; an empty one
            // recedes. The ring stops being a uniform decoration and starts
            // showing where the sky is busy.
            const busy = planets.some(
              (p) => !p.isEarth && p.geoLon != null && p.signIdx === i
            );
            return (
              <g key={`sign-${i}`}>
                <circle
                  cx={mid.x}
                  cy={mid.y}
                  r={11}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setSignHover(i)}
                  onMouseLeave={() => setSignHover((v) => (v === i ? null : v))}
                />
                {/* Hover is ink, not a new hue and not a size jump. Gold spoke a
                    colour the dial uses for nothing else, and growing the glyph
                    moved the very thing being pointed at. */}
                {hot && (
                  <circle
                    cx={mid.x}
                    cy={mid.y}
                    r={11}
                    fill="var(--foreground)"
                    opacity={night ? 0.12 : 0.07}
                    pointerEvents="none"
                  />
                )}
                <text
                  x={mid.x}
                  y={mid.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={hot ? "var(--foreground)" : night ? ZODIAC_INK.night : ZODIAC_INK.day}
                  opacity={hot ? 1 : busy ? (night ? 0.75 : 0.85) : night ? 0.22 : 0.3}
                  pointerEvents="none"
                  style={{ fontSize: 13.5, fontWeight: hot ? 600 : 400 }}
                >
                  {glyph}
                </text>
              </g>
            );
          })}
        </g>

        {/* Her Placidus houses, in both skies. No ring is drawn for them: the
            numerals alone mark the twelve sectors, and hovering one fills its
            wedge back to Earth, the point the houses are measured from. */}
        {personal && (
          <g>
{NATAL_CUSPS.map((cusp, hi) => {
                    const next = NATAL_CUSPS[(hi + 1) % 12];
                    const span = (((next - cusp) % 360) + 360) % 360;
                    const label = pointAt(cusp + span / 2, R_RING - 4);
                    const house = hi + 1;
                    const hot = houseHover === house;
                    const busy = planets.some(
                      (p) =>
                        !p.isEarth &&
                        p.geoLon != null &&
                        houseOfLongitude(p.geoLon) === house
                    );
                    return (
                      <g key={`house-${hi}`}>
                        {/* No wedge any more. The sector fill was the loudest
                            mark for the least information; the bodies standing in
                            the house say it better by lighting up. */}
                        <circle
                          cx={label.x}
                          cy={label.y}
                          r={11}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setHouseHover(house)}
                          onMouseLeave={() =>
                            setHouseHover((v) => (v === house ? null : v))
                          }
                        />
                        {hot && (
                          <circle
                            cx={label.x}
                            cy={label.y}
                            r={10}
                            fill="var(--foreground)"
                            opacity={night ? 0.12 : 0.07}
                            pointerEvents="none"
                          />
                        )}
                        <text
                          x={label.x}
                          y={label.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={hot ? "var(--foreground)" : night ? HOUSE_INK.night : HOUSE_INK.day}
                          opacity={hot ? 1 : busy ? (night ? 0.7 : 0.8) : night ? 0.2 : 0.28}
                          pointerEvents="none"
                          style={{ fontSize: 11, letterSpacing: "0.04em", fontWeight: hot ? 600 : 400 }}
                        >
                          {toRoman(house)}
                        </text>
                      </g>
                    );
                  })}
                          </g>
        )}

        {(() => {
            const earth = planets.find((p) => p.isEarth);
            if (!earth) return null;
            // Widest orb first, so the tightest aspect wins the planet's colour.
            const toneFor = new Map<string, string>();
            for (const asp of [...aspects].sort((x, y) => y.orb - x.orb)) {
              toneFor.set(asp.a.nameRu, asp.tone);
              toneFor.set(asp.b.nameRu, asp.tone);
            }
            return (
              <g>
                {planets
                  .filter((p) => !p.isEarth)
                  .map((p) => {
                    const pt = dialPoint(p, earth, night);
                    const tone = toneFor.get(p.nameRu);
                    return (
                      <g key={`sight-${p.nameRu}`}>
                        {/* Uniformly faint, whatever the planet is doing. These
                            lines say one thing only: aspects are measured from
                            Earth. Colouring them by aspect made the loudest mark
                            on the dial the one carrying no meaning. */}
                        {/* Only the bodies actually in an aspect are named, and
                            quietly: the point is to read the pair, not to label
                            the sky. */}
                        {tone && !p.isMoon && (
                          <text
                            x={pt.x}
                            y={pt.y + 13}
                            textAnchor="middle"
                            fill="var(--muted)"
                            opacity={0.75}
                            style={{ fontSize: 10 }}
                          >
                            {p.nameRu}
                          </text>
                        )}
                      </g>
                    );
                  })}
                {aspects.map((asp, i) => {
                  if (!drawn(asp)) return null;
                  // Pointing at a body lights everything it reaches, not just
                  // the one chord under the cursor. "What is this planet in
                  // aspect to" was the commonest question the web could not
                  // answer without tracing lines by eye.
                  const hot =
                    shown === `asp:${i}` ||
                    shown === asp.a.nameRu ||
                    shown === asp.b.nameRu;
                  const [pa, pb] = aspectEnds(asp);
                  // One family, one parameter. Every aspect thins toward the
                  // middle; how far it thins is the hardness of the aspect, and
                  // that is a scale rather than a switch. A trine barely dips, an
                  // opposition goes to nothing, a conjunction does not dip at all
                  // because the two are in the same place to begin with.
                  //
                  // Breaking the harmonious ones outright was the alternative and
                  // it is worse: the break is the only thing separating the two
                  // kinds, so breaking both leaves nothing but hue to tell them
                  // apart.
                  const MID_OPACITY: Record<string, number> = {
                    conjunction: 1,
                    trine: 0.78,
                    sextile: 0.58,
                    square: 0.18,
                    opposition: 0,
                  };
                  const mid = MID_OPACITY[asp.name] ?? 0.6;
                  const tense = asp.name === "square" || asp.name === "opposition";
                  const mx = (pa.x + pb.x) / 2;
                  const my = (pa.y + pb.y) / 2;
                  // Bowed away from the middle of the dial, so three of them can
                  // never close the triangle three straight chords would.
                  const bx = mx + (mx - C) * 0.16;
                  const by = my + (my - C) * 0.16;
                  const arc = `M${pa.x} ${pa.y} Q${bx} ${by} ${pb.x} ${pb.y}`;
                  // The break is a fade, not a cut. One line the whole way, gone
                  // to nothing at the midpoint and gathering again toward each
                  // body: the reach is continuous and only the meeting fails. A
                  // hard gap read as two separate marks that happened to line up.
                  const gid = `aspect-waist-${uid}-${i}`;
                  const baseInk = tense
                    ? night
                      ? TENSION_INK.night
                      : TENSION_INK.day
                    : asp.tone;
                  // A conjunction has no waist to draw, so it stays a flat stroke
                  // and skips the gradient entirely.
                  const ink = mid >= 1 ? baseInk : `url(#${gid})`;
                  return (
                    <g key={`asp-${i}`} style={{ transition: "opacity 120ms" }}>
                      {mid < 1 && (
                        <linearGradient
                          id={gid}
                          gradientUnits="userSpaceOnUse"
                          x1={pa.x}
                          y1={pa.y}
                          x2={pb.x}
                          y2={pb.y}
                        >
                          <stop offset="0%" stopColor={baseInk} stopOpacity={1} />
                          <stop offset="26%" stopColor={baseInk} stopOpacity={(1 + mid) / 2} />
                          <stop offset="50%" stopColor={baseInk} stopOpacity={mid} />
                          <stop offset="74%" stopColor={baseInk} stopOpacity={(1 + mid) / 2} />
                          <stop offset="100%" stopColor={baseInk} stopOpacity={1} />
                        </linearGradient>
                      )}
                      <path
                        d={arc}
                        fill="none"
                        stroke={ink}
                        strokeWidth={hot ? 3.4 : 1.9}
                        strokeLinecap="round"
                        filter={`url(#aspect-glow-${uid})`}
                        opacity={hot ? 0.4 : tense ? 0.15 : 0.12}
                      />
                      <path
                        d={arc}
                        fill="none"
                        stroke={ink}
                        strokeWidth={hot ? 1.1 : 0.6}
                        strokeLinecap="round"
                        opacity={hot ? 0.85 : tense ? 0.38 : 0.3}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })()}

        <circle
          cx={C}
          cy={C}
          r={night ? 34 : 26}
          fill={`url(#sun-corona-${uid})`}
          filter={night ? undefined : `url(#sun-haze-${uid})`}
        />
        <circle
          cx={C}
          cy={C}
          r={night ? 4.5 : 4.4}
          fill={night ? "#fff6d5" : "#f8c53c"}
          filter={`url(#body-glow-${uid})`}
          opacity={night || aspectsVisible ? 1 : 0.45}
        />
        {/* On paper the body is solid yellow with no hot centre: a pale dot
            inside it read as a hole, not as heat. */}
        <circle cx={C} cy={C} r={night ? 2.8 : 3.4} fill={night ? "#ffffff" : "#f5b81d"} />
        {/* The Sun is the switch for the aspect layer. Nothing else on the dial
            is a control, and it sits where a legend would have gone. */}
        <circle
            cx={C}
            cy={C}
            r={14}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              setAspectsVisible((v) => !v);
            }}
          >
            <title>{aspectsVisible ? "Скрыть аспекты" : "Показать аспекты"}</title>
          </circle>

        {/* Where each planet stood at birth, as a small dot on its own orbit,
            in that planet's own colour. An outlined ring read as an object of
            its own; a dot in the orbit's colour reads as a place on it.
            Drawn before the trails and the bodies so it never competes with
            where a planet is now: it is a reference mark, not a reading.

            The ring sits on the same radius as the live body rather than at the
            distance the planet actually had that day. The dial's radii are
            already schematic — logarithmic, so the inner planets do not collapse
            into the Sun — and a ghost floating a few pixels off its own orbit
            would read as a drawing error rather than as an ellipse. The angle,
            which is the part that carries meaning, is exact. */}
        {/* Dashed threads from today's planets to the natal mark under the
            pointer. Dashed on purpose, and the same dash the natal wheel uses
            for a transit: it says "this touches that", which is true. What it
            deliberately does not say is the angle — the mark sits at the
            planet's heliocentric place and the aspect is measured from Earth, so
            the line is a connector, not a measurement. The card carries the real
            aspect and orb. Drawn before the ghosts and the bodies. */}
        {natalCard &&
          natalHits.map((t, i) => {
            const n = natalPlanets.find((x) => x.name === natalCard);
            const liveOfNatal = planets.find((x) => x.name === natalCard);
            const from = planets.find((x) => x.name === t.transit.body.name);
            if (!n || !liveOfNatal || !from) return null;
            const a = dialPoint(from, earthPos, night);
            const b = pointAt(n.lon, radiusFor(liveOfNatal.au, night));
            return (
              <line
                key={`nt-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={ASPECT_TONE_COLOR[aspectTone(t.aspect.name)]}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={night ? 0.75 : 0.7}
                pointerEvents="none"
              />
            );
          })}

        {/* Names on the far end of each thread. A dashed line to an unlabelled
            dot makes you trace it back to find out what it reached; the whole
            point of the hover is to answer that without moving your eye twice. */}
        {natalCard &&
          natalHits.map((t, i) => {
            const from = planets.find((x) => x.name === t.transit.body.name);
            if (!from) return null;
            const at = dialPoint(from, earthPos, night);
            // Outward by default, flipped if the name would run past the edge of
            // the viewBox — an svg clips at its box, and a body on the outermost
            // orbit has barely thirty pixels of room. Width is estimated from the
            // character count: measuring text would mean a layout pass per frame.
            const w = t.transit.body.nameRu.length * 6.6;
            let right = at.x >= C;
            if (right && at.x + 11 + w > SIZE - 4) right = false;
            if (!right && at.x - 11 - w < 4) right = true;
            return (
              <text
                key={`ntl-${i}`}
                x={at.x + (right ? 11 : -11)}
                y={at.y + 4}
                textAnchor={right ? "start" : "end"}
                fill={night ? "#ffffff" : "var(--foreground)"}
                pointerEvents="none"
                style={{ fontSize: 12, fontWeight: 500 }}
              >
                {t.transit.body.nameRu}
              </text>
            );
          })}

        {personal && natalPlanets.map((n) => {
          const live = planets.find((p) => p.nameRu === n.nameRu);
          if (!live || live.isEarth || live.isMoon) return null;
          const at = pointAt(n.lon, radiusFor(live.au, night));
          return (
            <circle
              key={`natal-${n.nameRu}`}
              cx={at.x}
              cy={at.y}
              r={2}
              // Grey and rimless. In the planet's own colour the mark competed
              // with the planet itself; a ghost should read as absence of the
              // live thing, not as a second copy of it.
              fill="var(--muted)"
              opacity={
                natalHot === n.name ? (night ? 0.95 : 0.9) : night ? 0.38 : 0.34
              }
              style={{ transition: "opacity 120ms" }}
              pointerEvents="none"
            />
          );
        })}

        {planets.map((p, gi) => {
          const r = radiusFor(p.au, night);
          const pt = dialPoint(p, earthPos, night);
          // A body lights up when the pointer is on it, or on the house it is
          // standing in right now.
          const inLitHouse =
            !p.isEarth &&
            ((houseHover != null &&
              p.geoLon != null &&
              houseOfLongitude(p.geoLon) === houseHover) ||
              (signHover != null && p.geoLon != null && p.signIdx === signHover));
          const isHover = shown === p.nameRu || inLitHouse;
          // Hovering a sign that actually holds something pushes everyone else
          // back, so the group in it reads as a group. An empty sign changes
          // nothing: there would be nothing to compare against.
          const inHouse = (x: HelioPos) =>
            !x.isEarth && x.geoLon != null && houseOfLongitude(x.geoLon) === houseHover;
          const signHolds =
            signHover != null &&
            planets.some((x) => !x.isEarth && x.geoLon != null && x.signIdx === signHover);
          const houseHolds = houseHover != null && planets.some(inHouse);
          // Earth has no house and no geocentric sign: it is the vantage point,
          // so it is never one of the bodies in the sector being pointed at.
          // Holding it at full strength while everything else fell back read as
          // "Earth is in this house", and the card below it said otherwise. It
          // steps back with the rest now.
          // A pinned natal mark asks one question — what is touching this point
          // — so the bodies that answer it stay lit and the rest step back. No
          // line is drawn to them: the mark's place on the dial is heliocentric
          // and the aspect is geocentric, and a chord between the two would
          // state an angle that is not the aspect's.
          const touchesNatal =
            natalHits.some((t) => t.transit.body.name === p.name);
          const dimmed = p.isEarth
            ? signHolds || houseHolds || natalHits.length > 0
            : (signHolds && p.signIdx !== signHover) ||
              (houseHolds && !inHouse(p)) ||
              (natalHits.length > 0 && !touchesNatal);
          const speed = speedFactor(p.degPerDay);
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
                  <stop offset="0%" stopColor={p.tone} stopOpacity={0} />
                  <stop offset="55%" stopColor={p.tone} stopOpacity={isHover ? (night ? 0.55 : 0.6) : night ? 0.3 : 0.38} />
                  <stop offset="100%" stopColor={p.tone} stopOpacity={isHover ? 1 : night ? 0.85 : 0.9} />
                </linearGradient>
              </defs>
              {!p.isMoon && (
              <path
                d={trailPath(p.lon, r, deg)}
                fill="none"
                stroke={`url(#${gid})`}
                strokeWidth={0.9 + speed * 1.3}
                strokeLinecap="round"
              />
              )}
              {/* Two ways to draw a body. At night it is light on dark: a halo
                  in the planet's tint, the tint itself, a white spark. On paper
                  a filled dark dot reads as a hole punched in the page, so the
                  body is hollow instead — a ring around the page's own white,
                  which reads as a small luminary rather than a blot. */}
              {p.isMoon && inLitHouse && (
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
                  <circle cx={pt.x} cy={pt.y} r={2.3} fill={bodyInk(p, night)} />
                )
              ) : night ? (
                <>
                  {/* Standing in the house under the pointer: the same gold lift
                      the paper sky gives, so the answer to "who is in this house"
                      looks the same in both. */}
                  {inLitHouse && (
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
                    r={inLitHouse ? (p.isEarth ? 6.4 : 6.8) : p.isEarth ? 4.2 : 4.6}
                    // The lift is the body's own colour, only stronger. Gold said
                    // "selected" in a language nothing else on the dial speaks.
                    fill={p.tone}
                    filter={`url(#${inLitHouse ? "lift" : "body"}-glow-${uid})`}
                    opacity={inLitHouse ? 0.7 : isHover ? 0.55 : 0.38}
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={p.isEarth ? 2.7 : 3.1}
                    fill="var(--surface)"
                  />
                  {/* The ring thickens inward, not outward: a stroke sits centred
                      on its path, so the radius drops by half the width and the
                      outer edge stays exactly where it was. The body keeps its
                      footprint on the dial and only the hole gets smaller. */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={(p.isEarth ? 3.2 : 3.7) - RING_WIDTH / 2}
                    fill="none"
                    stroke={bodyInk(p, night)}
                    strokeWidth={RING_WIDTH}
                    opacity={isHover ? 1 : 0.92}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>

      {signHover !== null && (() => {
        // Earth is left out: it is the point everything is being read from, and
        // its own sign here is heliocentric, which says nothing about her chart.
        const inside = planets.filter(
          (p) => !p.isEarth && p.geoLon != null && p.signIdx === signHover
        );
        return (
          <div
            className="absolute z-20 pointer-events-none rounded-md px-2.5 py-1.5"
            style={{
              left: `${(pointAt(signHover * 30 + 15, R_RING - 22).x / SIZE) * 100}%`,
              top: `${(pointAt(signHover * 30 + 15, R_RING - 22).y / SIZE) * 100}%`,
              transform: "translate(-50%, -115%)",
              background: night ? "rgba(8, 10, 16, 0.94)" : "var(--surface)",
              border: night ? "1px solid rgba(255,255,255,0.16)" : "1px solid var(--border-strong)",
              minWidth: 190,
              maxWidth: 320,
            }}
          >
            <div
              className="text-sm font-medium"
              style={{ color: night ? "#ffffff" : "var(--foreground)" }}
            >
              {ZODIAC_GLYPHS[signHover]} {ZODIAC_SIGNS_RU[signHover]}
            </div>
            {inside.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {inside.map((p) => (
                  <div key={p.nameRu} className="text-[11px] flex items-baseline gap-1.5">
                    <span style={{ color: p.tone }}>{p.glyph}</span>
                    <span style={{ color: night ? "rgba(255,255,255,0.9)" : "var(--foreground)" }}>
                      {p.nameRu}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ color: night ? "rgba(255,255,255,0.5)" : "var(--muted)" }}
                    >
                      {Math.floor(p.degreeInSign)}°
                    </span>
                    <span
                      className="ml-auto"
                      style={{ color: night ? "rgba(255,255,255,0.5)" : "var(--muted)" }}
                    >
                      {BODY_ROLE_RU[p.name] ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {houseHover !== null && (() => {
        const cusp = NATAL_CUSPS[houseHover - 1];
        const next = NATAL_CUSPS[houseHover % 12];
        const span = (((next - cusp) % 360) + 360) % 360;
        const at = pointAt(cusp + span / 2, R_RING - 4);
        const inside = planets.filter(
          (p) => !p.isEarth && p.geoLon != null && houseOfLongitude(p.geoLon) === houseHover
        );
        return (
          <div
            className="absolute z-20 pointer-events-none rounded-md px-2.5 py-1.5"
            // Back at the numeral it belongs to. Under the dial it was accurate
            // and useless: you had to hunt for it. The lit orbits keep the answer
            // readable even where the card covers the ring.
            style={{
              left: `${(at.x / SIZE) * 100}%`,
              top: `${(at.y / SIZE) * 100}%`,
              transform: "translate(-50%, -115%)",
              background: night ? "rgba(8, 10, 16, 0.94)" : "var(--surface)",
              border: night ? "1px solid rgba(255,255,255,0.16)" : "1px solid var(--border-strong)",
              minWidth: 190,
              maxWidth: 320,
            }}
          >
            <div
              className="text-sm font-medium"
              style={{ color: night ? "#ffffff" : "var(--foreground)" }}
            >
              {toRoman(houseHover)} дом
            </div>
            <div
              className="text-[11px]"
              style={{ color: night ? "rgba(255,255,255,0.6)" : "var(--muted)" }}
            >
              {HOUSE_MEANING_RU[houseHover] ?? ""}
            </div>
            {/* An empty house says so by having nothing under its name. Writing
                it out made the card taller for less. */}
            {inside.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {inside.map((p) => (
                  <div key={p.nameRu} className="text-[11px] flex items-baseline gap-1.5">
                    <span style={{ color: p.tone }}>{p.glyph}</span>
                    <span style={{ color: night ? "rgba(255,255,255,0.9)" : "var(--foreground)" }}>
                      {p.nameRu}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ color: night ? "rgba(255,255,255,0.5)" : "var(--muted)" }}
                    >
                      {ZODIAC_GLYPHS[Math.floor((p.geoLon ?? 0) / 30)]}{" "}
                      {Math.floor((p.geoLon ?? 0) % 30)}°
                    </span>
                    <span
                      className="ml-auto"
                      style={{ color: night ? "rgba(255,255,255,0.5)" : "var(--muted)" }}
                    >
                      {BODY_ROLE_RU[p.name] ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* The natal mark's own card. Hovering says only which point it is —
          a mark this small needs a name before it needs a reading. Pinning it
          adds what today's sky is doing to that point. */}
      {natalCard && (() => {
        const n = natalPlanets.find((x) => x.name === natalCard);
        const live = planets.find((x) => x.name === natalCard);
        if (!n || !live) return null;
        const at = pointAt(n.lon, radiusFor(live.au, night));
        const open = pinned === `natal:${natalCard}`;
        return (
          <div
            className="absolute pointer-events-none rounded-md px-2.5 py-1.5"
            style={{
              left: `${(at.x / SIZE) * 100}%`,
              top: `${(at.y / SIZE) * 100}%`,
              transform: "translate(-50%, -125%)",
              background: night ? "rgba(8, 10, 16, 0.92)" : "var(--surface)",
              border: night
                ? "1px solid rgba(255, 255, 255, 0.16)"
                : "1px solid var(--border-strong)",
              whiteSpace: open ? "normal" : "nowrap",
              width: open ? 240 : undefined,
            }}
          >
            <div
              className="text-sm font-medium flex items-baseline gap-1.5"
              style={{ color: night ? "#ffffff" : "var(--foreground)" }}
            >
              <span style={{ color: "var(--muted)" }}>{n.glyph}</span>
              {n.nameRu} нат.
            </div>
            {open && (
              <div className="mt-1.5 flex flex-col gap-0.5">
                {natalHits.length === 0 ? (
                  <span
                    className="text-[11px]"
                    style={{ color: night ? "rgba(255,255,255,0.55)" : "var(--muted)" }}
                  >
                    сегодня к этой точке ничего не идёт
                  </span>
                ) : (
                  natalHits.map((t, i) => (
                    <div key={i} className="text-[11px] flex items-baseline gap-1.5">
                      <span style={{ color: planetTone(t.transit.body.name, night) }}>
                        {t.transit.body.glyph}
                      </span>
                      <span
                        style={{ color: night ? "rgba(255,255,255,0.9)" : "var(--foreground)" }}
                      >
                        {t.transit.body.nameRu}
                      </span>
                      <span style={{ color: ASPECT_TONE_COLOR[aspectTone(t.aspect.name)] }}>
                        {t.aspect.symbol}
                      </span>
                      <span
                        className="ml-auto tabular-nums"
                        style={{ color: night ? "rgba(255,255,255,0.5)" : "var(--muted)" }}
                      >
                        {t.orb.toFixed(1)}°
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })()}

      {activeAspect && (() => {
        const pa = pointAt(activeAspect.a.lon, radiusFor(activeAspect.a.au, night));
        const pb = pointAt(activeAspect.b.lon, radiusFor(activeAspect.b.au, night));
        const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
        const reading = readSkyAspect(
          activeAspect.a.name,
          activeAspect.a.geoLon!,
          activeAspect.b.name,
          activeAspect.b.geoLon!,
          activeAspect.name,
          activeAspect.orb,
          ASPECT_ORB,
          selected
        );
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
            <div className="text-sm font-medium" style={{ color: activeAspect.tone }}>
              {activeAspect.a.glyph} {activeAspect.a.nameRu} {activeAspect.symbol}{" "}
              {activeAspect.b.glyph} {activeAspect.b.nameRu}
            </div>
            {/* Same card as on the timeline, minus the line about the chosen
                day: a sky aspect is by definition happening on it. */}
            <div className="text-[10px] text-[color:var(--muted)] tabular-nums mt-0.5">
              орб {activeAspect.orb.toFixed(1)}° · дома {toRoman(reading.houses[0])} и{" "}
              {toRoman(reading.houses[1])} · сила {reading.strength}
            </div>
            {reading.hook && (
              <div className="text-[10px]" style={{ color: activeAspect.tone }}>
                задевает натал: {reading.hook.transit.body.glyph}{" "}
                {reading.hook.aspect.symbol} {reading.hook.natal.body.glyph}{" "}
                {reading.hook.natal.body.nameRu}
              </div>
            )}
            <div className="text-[11px] text-[color:var(--foreground)] mt-1 leading-snug">
              <span style={{ color: activeAspect.tone }}>{reading.word}</span>
              {reading.word && " · "}
              {reading.brief}
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
          {/* The name stays plain text. Colour on this dial means an aspect, and
              a planet-tinted heading kept implying one. The tint goes on a dot
              instead, where it only says which body this is. */}
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
            {active.glyph} {active.nameRu}
          </div>
          <div className="text-[11px] tabular-nums" style={{ color: night ? "rgba(255,255,255,0.6)" : "var(--muted)" }}>
            {SIGNS[active.signIdx]} {Math.floor(active.degreeInSign)}° ·{" "}
            {active.isMoon
              ? `${Math.round((active.au * 149597870.7) / 1000)} тыс. км`
              : `${active.au.toFixed(2)} а.е.`}{" "}
            ·{" "}
            {active.degPerDay < 0.1 ? active.degPerDay.toFixed(3) : active.degPerDay.toFixed(2)}°/сут
          </div>
          {(() => {
            const { inSky, toNatal } = aspectsOf(active, skyAspects);
            if (inSky.length === 0 && toNatal.length === 0) return null;
            const dim = night ? "rgba(255,255,255,0.4)" : "var(--muted)";
            const ink = night ? "rgba(255,255,255,0.85)" : "var(--foreground)";
            const group = (title: string, hits: AspectHit[]) =>
              hits.length === 0 ? null : (
                <div className="flex flex-col gap-0.5">
                  <div className="text-[9px] uppercase tracking-wide" style={{ color: dim }}>
                    {title}
                  </div>
                  {hits.map((h, i) => (
                    <div key={i} className="text-[11px] flex items-baseline gap-1.5">
                      <span style={{ color: h.tone }}>{h.symbol}</span>
                      <span style={{ color: ink }}>{h.label}</span>
                    </div>
                  ))}
                </div>
              );
            return (
              <div className="mt-1.5 grid grid-cols-2 gap-x-3">
                {group("в небе", inSky)}
                {group("к наталу", toNatal)}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
