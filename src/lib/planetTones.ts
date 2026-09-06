/**
 * The tints the orrery paints its bodies with, pulled out so anything else
 * showing a planet can use the same colour. Two sets: the dial draws on a black
 * field at night and on paper by day, and one palette cannot serve both.
 */
export const PLANET_TONE: Record<string, { day: string; night: string }> = {
  Mercury: { day: "#8b6a3b", night: "#a8a29e" },
  Venus: { day: "#d183c4", night: "#cab16a" },
  Earth: { day: "#2f86bd", night: "#6fa8dc" },
  Mars: { day: "#8f2f42", night: "#d98e74" },
  Jupiter: { day: "#e8a021", night: "#c8a26d" },
  Saturn: { day: "#90999f", night: "#bfb488" },
  Uranus: { day: "#3f9c97", night: "#8bb8b4" },
  Neptune: { day: "#4f63b8", night: "#98a4cc" },
  Pluto: { day: "#7b6f92", night: "#a99cc4" },
  Moon: { day: "#7cb2dc", night: "#ffffff" },
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
