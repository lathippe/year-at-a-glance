import type { Person } from "./types";

/**
 * A synthetic reference chart, not a person. The engine builds house cusps at
 * module load and needs an epoch and a place to do it; this page never draws
 * houses or a natal wheel, so the values only have to exist.
 *
 * Deliberately J2000 at the Greenwich meridian on the equator: no real birth
 * data ships in this repository.
 */
export const reference: Person = {
  id: "reference",
  name: "Orrery",
  short: "Orrery",
  birthUTC: "2000-01-01T12:00:00Z",
  lat: 0,
  lon: 0,
  footer: "Reference epoch J2000 · heliocentric dial · geocentric aspects",
};
