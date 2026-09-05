import { SearchMoonQuarter, NextMoonQuarter, Ecliptic, GeoVector, Body, MakeTime } from "astronomy-engine";
import { houseOfLongitude, HOUSE_MEANING_RU, toRoman, ZODIAC_GLYPHS, ZODIAC_SIGNS_RU } from "./astrology";

export type Lunation = {
  ms: number;
  kind: "new" | "full";
  sign: string;
  signGlyph: string;
  degree: number;
  house: number;
  houseMeaning: string;
  houseRoman: string;
};

/** New and full moons inside the span, with the house each one falls into. */
export function lunations(centre: Date, spanDays: number): Lunation[] {
  const from = new Date(centre.getTime() - spanDays * 86400000);
  const until = centre.getTime() + spanDays * 86400000;
  const out: Lunation[] = [];

  let q = SearchMoonQuarter(from);
  while (q.time.date.getTime() <= until) {
    // 0 is the new moon, 2 the full one; the quarters between are not marked.
    if (q.quarter === 0 || q.quarter === 2) {
      const lon =
        ((Ecliptic(GeoVector(Body.Moon, MakeTime(q.time.date), true)).elon % 360) + 360) % 360;
      const signIdx = Math.floor(lon / 30);
      const house = houseOfLongitude(lon);
      const meaning = HOUSE_MEANING_RU[house] ?? "";
      out.push({
        ms: q.time.date.getTime(),
        kind: q.quarter === 0 ? "new" : "full",
        sign: ZODIAC_SIGNS_RU[signIdx],
        signGlyph: ZODIAC_GLYPHS[signIdx],
        degree: lon - signIdx * 30,
        house,
        houseMeaning: meaning,
        houseRoman: toRoman(house),
      });
    }
    q = NextMoonQuarter(q);
  }
  return out;
}
