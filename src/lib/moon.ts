/**
 * Moon phase computation using the Meeus simplified algorithm.
 * Precision is ~1 day which is fine for a daily dashboard.
 */

const SYNODIC_MONTH = 29.530588853; // days between new moons
const REFERENCE_NEW_MOON = new Date("2000-01-06T18:14:00Z").getTime();

export type MoonPhase = {
  phaseFraction: number; // 0 = new, 0.5 = full, 1 = new again
  illumination: number; // 0..1
  name: string;
  emoji: string;
  nextNewMoon: Date;
  nextFullMoon: Date;
  daysToNextFull: number;
  daysToNextNew: number;
};

function phaseNameFromFraction(f: number): { name: string; emoji: string } {
  if (f < 0.02 || f > 0.98) return { name: "New Moon", emoji: "🌑" };
  if (f < 0.23) return { name: "Waxing Crescent", emoji: "🌒" };
  if (f < 0.27) return { name: "First Quarter", emoji: "🌓" };
  if (f < 0.48) return { name: "Waxing Gibbous", emoji: "🌔" };
  if (f < 0.52) return { name: "Full Moon", emoji: "🌕" };
  if (f < 0.73) return { name: "Waning Gibbous", emoji: "🌖" };
  if (f < 0.77) return { name: "Last Quarter", emoji: "🌗" };
  return { name: "Waning Crescent", emoji: "🌘" };
}

function findNextPhase(fromDate: Date, targetFraction: number): Date {
  const now = fromDate.getTime();
  const ageDays = ((now - REFERENCE_NEW_MOON) / (1000 * 60 * 60 * 24)) % SYNODIC_MONTH;
  let daysToTarget = (targetFraction * SYNODIC_MONTH - ageDays + SYNODIC_MONTH) % SYNODIC_MONTH;
  if (daysToTarget < 0.5) daysToTarget += SYNODIC_MONTH; // if we just passed it, go to next
  return new Date(now + daysToTarget * 24 * 60 * 60 * 1000);
}

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const ageDays = ((date.getTime() - REFERENCE_NEW_MOON) / (1000 * 60 * 60 * 24)) % SYNODIC_MONTH;
  const phaseFraction = ageDays / SYNODIC_MONTH;

  // Illumination: (1 - cos(2π · phase)) / 2 gives a smooth 0→1→0 curve
  const illumination = (1 - Math.cos(2 * Math.PI * phaseFraction)) / 2;

  const { name, emoji } = phaseNameFromFraction(phaseFraction);

  const nextFullMoon = findNextPhase(date, 0.5);
  const nextNewMoon = findNextPhase(date, 0);

  const dayMs = 1000 * 60 * 60 * 24;
  const daysToNextFull = Math.round((nextFullMoon.getTime() - date.getTime()) / dayMs);
  const daysToNextNew = Math.round((nextNewMoon.getTime() - date.getTime()) / dayMs);

  return {
    phaseFraction,
    illumination,
    name,
    emoji,
    nextFullMoon,
    nextNewMoon,
    daysToNextFull,
    daysToNextNew,
  };
}
