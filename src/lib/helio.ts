import { Body, MakeTime, HelioVector, HelioDistance, GeoVector, Ecliptic } from "astronomy-engine";

/** The Sun's own planets, in orbital order. Earth is here too — on this dial it
    is a planet like the rest, not the vantage point. */
const PLANETS = [
  { body: Body.Mercury, nameRu: "Меркурий", glyph: "☿", tone: "var(--planet-mercury)" },
  { body: Body.Venus, nameRu: "Венера", glyph: "♀", tone: "var(--planet-venus)" },
  { body: Body.Earth, nameRu: "Земля", glyph: "⊕", tone: "var(--accent)" },
  { body: Body.Mars, nameRu: "Марс", glyph: "♂", tone: "var(--planet-mars)" },
  { body: Body.Jupiter, nameRu: "Юпитер", glyph: "♃", tone: "var(--planet-jupiter)" },
  { body: Body.Saturn, nameRu: "Сатурн", glyph: "♄", tone: "var(--planet-saturn)" },
  { body: Body.Uranus, nameRu: "Уран", glyph: "⛢", tone: "var(--planet-uranus)" },
  { body: Body.Neptune, nameRu: "Нептун", glyph: "♆", tone: "var(--planet-neptune)" },
] as const;

export type HelioPos = {
  /** English name, the key the shared dictionaries are written against. */
  name: string;
  nameRu: string;
  glyph: string;
  /** Muted hue for this body, a CSS variable that flips with the theme. */
  tone: string;
  /** Heliocentric ecliptic longitude, degrees 0..360. */
  lon: number;
  /** Distance from the Sun, astronomical units. */
  au: number;
  /** Degrees of heliocentric longitude per day, measured over the last ten
      days. Heliocentric motion never goes retrograde, so this is always > 0. */
  degPerDay: number;
  /** Ecliptic longitude as seen from Earth. This is the astrological position,
      the one aspects are measured in. Null for Earth itself. */
  geoLon: number | null;
  signIdx: number;
  degreeInSign: number;
  isEarth: boolean;
  /** The Moon is not on a solar orbit and never gets one here: it is drawn as a
      satellite beside Earth. Its longitude, sign and speed are geocentric,
      which is also the only frame where they mean anything. */
  isMoon: boolean;
};

const SPEED_WINDOW_DAYS = 10;

const MOON_WINDOW_DAYS = 1;

function moonPosition(date: Date): HelioPos {
  const t = MakeTime(date);
  const tBack = MakeTime(new Date(date.getTime() - MOON_WINDOW_DAYS * 86400000));
  const lon = ((Ecliptic(GeoVector(Body.Moon, t, true)).elon % 360) + 360) % 360;
  const lonBack = ((Ecliptic(GeoVector(Body.Moon, tBack, true)).elon % 360) + 360) % 360;
  const signIdx = Math.floor(lon / 30);
  return {
    name: "Moon",
    nameRu: "Луна",
    glyph: "☽",
    tone: "var(--planet-mercury)",
    lon,
    au: GeoVector(Body.Moon, t, true).Length(),
    degPerDay: ((((lon - lonBack) % 360) + 360) % 360) / MOON_WINDOW_DAYS,
    geoLon: lon,
    signIdx,
    degreeInSign: lon - signIdx * 30,
    isEarth: false,
    isMoon: true,
  };
}

export function helioPositions(date: Date): HelioPos[] {
  const t = MakeTime(date);
  const tBack = MakeTime(new Date(date.getTime() - SPEED_WINDOW_DAYS * 86400000));
  const bodies = PLANETS.map((p) => {
    const lon = ((Ecliptic(HelioVector(p.body, t)).elon % 360) + 360) % 360;
    const lonBack = ((Ecliptic(HelioVector(p.body, tBack)).elon % 360) + 360) % 360;
    const swept = ((lon - lonBack) % 360 + 360) % 360;
    const signIdx = Math.floor(lon / 30);
    return {
      name: String(p.body),
      nameRu: p.nameRu,
      glyph: p.glyph,
      tone: p.tone,
      lon,
      au: HelioDistance(p.body, t),
      degPerDay: swept / SPEED_WINDOW_DAYS,
      geoLon:
        p.body === Body.Earth
          ? null
          : ((Ecliptic(GeoVector(p.body, t, true)).elon % 360) + 360) % 360,
      signIdx,
      degreeInSign: lon - signIdx * 30,
      isEarth: p.body === Body.Earth,
      isMoon: false,
    };
  });
  return [...bodies, moonPosition(date)];
}
