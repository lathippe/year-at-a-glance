"use client";

import type { Ratio } from "@/lib/periods";

/**
 * The period ratios, listed. The dial shows angles at one instant; these hold
 * across the whole window and every window, and they are the idea the object
 * exists for. Pointing at a row lifts the pair's orbits on the dial, so a
 * ratio on paper can be found as two rings.
 */
export function RatioPanel({
  ratios,
  onLit,
  className = "",
}: {
  ratios: Ratio[];
  /** English body names to lift on the dial; empty to release. */
  onLit: (names: string[]) => void;
  className?: string;
}) {
  return (
    <section aria-label="Simple ratios between orbital periods" className={`flex flex-col gap-1.5 ${className}`}>
      <div className="label">simple ratios</div>
      <table className="text-[12px] tabular-nums border-separate" style={{ borderSpacing: "0 2px" }}>
        <tbody>
          {ratios.map((r) => {
            const pct = r.deviation * 100;
            const sign = pct < 0 ? "−" : "+";
            const years = (d: number) => `${(d / 365.25).toFixed(2)} yr`;
            return (
              <tr
                key={`${r.a}-${r.b}`}
                className="ratio-row"
                onMouseEnter={() => onLit([r.a, r.b])}
                onMouseLeave={() => onLit([])}
                onClick={() => onLit([r.a, r.b])}
                title={`${r.a} ${years(r.aDays)} · ${r.b} ${years(r.bDays)}`}
              >
                <td className="pr-3 whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                  {r.a} <span style={{ color: "var(--muted)" }}>:</span> {r.b}
                </td>
                <td className="pr-3 font-mono whitespace-nowrap text-right" style={{ color: "var(--foreground)" }}>
                  {r.p}
                  <span style={{ color: "var(--muted)" }}> : </span>
                  {r.q}
                </td>
                <td className="pr-3 font-mono text-right" style={{ color: "var(--muted)" }}>
                  {r.actual.toFixed(3)}
                </td>
                <td className="font-mono text-right" style={{ color: "var(--muted)" }}>
                  {sign}
                  {Math.abs(pct).toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
