/**
 * The tints the orrery paints its bodies with, pulled out so anything else
 * showing a planet can use the same colour. Two sets: the dial draws on a black
 * field at night and on paper by day, and one palette cannot serve both.
 */
export const PLANET_TONE: Record<string, { day: string; night: string }> = {
  // By day the bodies wear roughly their own colours: Mercury's grey, Venus's
  // cloud cream, Mars rusted, Jupiter's bands, Saturn's butterscotch, the two
  // ice giants pale and deep. It is a picture of the solar system, so the colour
  // is allowed to mean the planet rather than an arbitrary series slot — which
  // is what a validated categorical palette assumes it means. What identity
  // actually rests on here is the orbit a body sits on, and that never moves.
  //
  // The cost is measurable and worth naming: Jupiter against Pluto is ΔE 6.4 in
  // normal vision, Uranus against the Moon 4.8 for a deutan reader, and Venus at
  // 1.7:1 has almost no contrast against paper. The rim is what answers the last
  // one — see rimFor — and orbit radius answers the first two.
  Mercury: { day: "#7b736b", night: "#a8a29e" },
  Venus: { day: "#d0af6c", night: "#cab16a" },
  Earth: { day: "#3b7fbe", night: "#6fa8dc" },
  Mars: { day: "#b0472b", night: "#d98e74" },
  Jupiter: { day: "#c07a38", night: "#c8a26d" },
  Saturn: { day: "#bd964b", night: "#bfb488" },
  Uranus: { day: "#6fb5bd", night: "#8bb8b4" },
  Neptune: { day: "#2f47a0", night: "#98a4cc" },
  Pluto: { day: "#a37f66", night: "#a99cc4" },
  Moon: { day: "#a8a49c", night: "#ffffff" },
  Sun: { day: "#f5b81d", night: "#fff6d5" },
};

export function planetTone(bodyName: string, night: boolean): string {
  const t = PLANET_TONE[bodyName];
  if (!t) return "var(--muted)";
  return night ? t.night : t.day;
}

/**
 * Ink that stays legible on a disc of the given colour. The Sun and the Moon are
 * pale enough that white glyphs vanish on them, so anything light gets a dark
 * brown instead of guessing per body.
 */
export function inkOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Rec. 601 luma is close enough for a two-way choice.
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? "#2c2411" : "#ffffff";
}

/**
 * A body's colour pushed toward white or black. The day dial paints planets as
 * little spheres, and a sphere needs a lit side and a shaded one out of the one
 * hue it is allowed — mixing in sRGB is close enough at four pixels across.
 */
export function mixHex(hex: string, toward: "white" | "black", k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const end = toward === "white" ? 255 : 0;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(c + (end - c) * k)
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The edge a body wears on paper. Real planets are pale — Venus is 1.7:1 against
 * white — so a fixed rim leaves the bright ones as smudges and the dark ones
 * outlined twice over. The darkening rises with the body's own lightness, which
 * gives every disc an edge of roughly the same weight without giving any of them
 * a colour that is not theirs.
 */
export function rimFor(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return mixHex(hex, "black", 0.26 + luma * 0.3);
}
