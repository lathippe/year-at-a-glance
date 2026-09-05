/**
 * Minimal SVG moon disc.
 * phaseFraction: 0 = new, 0.5 = full, 1 = new again.
 * Uses two overlapping circles and a clipping ellipse to draw the terminator.
 */

type Props = {
  phaseFraction: number;
  size?: number;
};

export function MoonDisc({ phaseFraction, size = 64 }: Props) {
  const r = size / 2;
  const cx = r;
  const cy = r;

  // Shadow side direction: 0–0.5 waxing (shadow on left), 0.5–1 waning (shadow on right)
  const isWaxing = phaseFraction < 0.5;

  // Terminator ellipse: ratio of shadow width to full width
  // Full moon = 0 shadow, New moon = full shadow, Half moon = 1.0 (flat terminator)
  const terminator = Math.cos(2 * Math.PI * phaseFraction); // 1 at new, -1 at full, 0 at half
  const rx = Math.abs(terminator) * r;

  // Which side is illuminated
  const illuminatedPath =
    terminator > 0
      ? // Less than half illuminated (crescent)
        `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${isWaxing ? 1 : 0} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${isWaxing ? 0 : 1} ${cx} ${cy - r} Z`
      : // More than half illuminated (gibbous)
        `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${isWaxing ? 1 : 0} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${isWaxing ? 1 : 0} ${cx} ${cy - r} Z`;

  // Ring scales with the glyph so it stays a hairline at 11px and at 56px.
  const ring = Math.max(0.5, size * 0.02);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Shadow side — transparent */}
      <circle cx={cx} cy={cy} r={r} fill="transparent" />
      {/* Hairline outline. Drawn before the lit side: at small sizes the ring is
          as thick as the crescent itself and would paint over it. */}
      <circle
        cx={cx}
        cy={cy}
        r={r - ring / 2}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={ring}
      />
      {/* Illuminated side. Stroked as well as filled so a near-new sliver, which
          is under a pixel wide at glyph sizes, still reads. */}
      <path
        d={illuminatedPath}
        fill="#f5e07a"
        stroke="#f5e07a"
        strokeWidth={Math.max(0.6, size * 0.045)}
        strokeLinejoin="round"
      />
    </svg>
  );
}
