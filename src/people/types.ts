/** Everything about a chart that is one person's and not the next person's. */
export type Person = {
  /** Value of NEXT_PUBLIC_PERSON that selects this chart. */
  id: string;
  /** Shown in the header. */
  name: string;
  /** Shown in the browser tab, so keep it to a first name. */
  short: string;
  /**
   * Birth moment in **UT**, not local time. Historic offsets are the single
   * biggest source of a wrong chart: the USSR ran summer time at UTC+4, so a
   * A birth given in local summer time must be converted to UT first.
   */
  birthUTC: string;
  lat: number;
  lon: number;
  /** The line in the footer: local time, place, coordinates. */
  footer: string;
};
