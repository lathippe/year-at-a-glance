// A read of one life sphere (natal house), built from the transits landing in
// it right now. Deterministic: the same transits always produce the same text.
//
// The per-aspect `meaning` strings already say what a single transit is about.
// What they cannot say is what the sphere as a whole is doing — four transits
// at once is a different situation from one, and a sphere with only tension
// asks for something different than a sphere with only flow. That synthesis is
// what this file makes: the shift, what to expect, what to watch for, what to
// do, and what not to.
//
// The vocabulary mirrors `meaningFor` in astrology.ts — same planet roles, same
// aspect flavours — so a sphere card and a transit card never contradict.

export type DigestTransit = {
  transitName: string; // English planet key
  transitRu: string;
  aspectName: string;
  aspectRu: string;
  natalRu: string;
  strength: number;
  exitsOrb: string | null;
};

export type DigestUpcoming = {
  transitName: string;
  transitRu: string;
  aspectName: string;
  aspectRu: string;
  natalRu: string;
  tier: "strong" | "notable" | "mild";
  daysToStart: number | null;
};

export type SphereDigest = {
  shift: string;
  expect: string[];
  beware: string[];
  doNow: string[];
  dont: string[];
};

const HARMONIOUS = new Set(["sextile", "trine"]);
const TENSION = new Set(["square", "opposition"]);

// A conjunction only intensifies — whether that reads as an opening or as
// pressure depends entirely on which planet is sitting there.
const HARD_PLANETS = new Set(["Saturn", "Pluto", "Uranus", "Mars", "Neptune"]);

function isTension(t: { aspectName: string; transitName: string }): boolean {
  if (TENSION.has(t.aspectName)) return true;
  return t.aspectName === "conjunction" && HARD_PLANETS.has(t.transitName);
}
function isFlow(t: { aspectName: string; transitName: string }): boolean {
  if (HARMONIOUS.has(t.aspectName)) return true;
  return t.aspectName === "conjunction" && !HARD_PLANETS.has(t.transitName);
}

// What each transiting planet brings when it is working with you.
const PLANET_BRINGS: Record<string, string> = {
  Sun: "короткое окно видимости: тебя заметно, есть силы показать сделанное",
  Moon: "эмоциональный акцент на пару дней, не больше",
  Mercury: "разговоры, письма, ясность формулировок",
  Venus: "лёгкость в контактах, деньгах и вкусе",
  Mars: "напор и желание наконец начать",
  Jupiter: "рост и предложения, рамка становится шире",
  Saturn: "то, что выстоит проверку, станет прочным по-настоящему",
  Uranus: "неожиданный сдвиг, который убирает то, что давно жало",
  Neptune: "интуицию и творческий доступ без усилия",
  Pluto: "глубину: тянет к настоящему, мелочи отваливаются сами",
};

// What to watch for when the same planet is pressing.
const PLANET_RISK: Record<string, string> = {
  Sun: "спор о том, кто прав, на ровном месте",
  Moon: "решение, принятое на эмоциональном пике",
  Mercury: "ошибку в деталях и недосказанность, которая потом дорого стоит",
  Venus: "трату ради утешения и уступку, о которой пожалеешь",
  Mars: "резкую реакцию и цену спешки",
  Jupiter: "переоценить масштаб и взять больше, чем потянешь",
  Saturn: "ощущение тупика и самонаказание за медленность",
  Uranus: "снести разом то, что чинится точечно",
  Neptune: "поверить обещанию без деталей",
  Pluto: "борьбу за контроль там, где дешевле отпустить",
};

const PLANET_DO: Record<string, string> = {
  Sun: "показывать сделанное, занимать место",
  Moon: "дать себе бытовой уход и тишину",
  Mercury: "писать, формулировать, договариваться на словах",
  Venus: "вкладываться в себя, в отношения, в вещи, которые нравятся",
  Mars: "начинать и двигаться, тратить силу на конкретное",
  Jupiter: "учиться и соглашаться на большее, чем привычно",
  Saturn: "строить медленно и доводить до конца одно, а не пять",
  Uranus: "пробовать малыми экспериментами",
  Neptune: "делать творческое и слушать, что подсказывает интуиция",
  Pluto: "идти вглубь и разбирать корень, а не симптом",
};

const PLANET_DONT: Record<string, string> = {
  Sun: "мериться собой с другими",
  Moon: "решать на эмоциональном пике",
  Mercury: "подписывать не перечитав",
  Venus: "покупать, чтобы утешиться",
  Mars: "реагировать сгоряча",
  Jupiter: "обещать на вырост",
  Saturn: "форсировать и наказывать себя за медленность",
  Uranus: "ломать всё разом",
  Neptune: "верить туману вместо деталей",
  Pluto: "лезть в борьбу за контроль",
};

// How to walk through each aspect type — mirrors aspectFlavor.doit.
const ASPECT_DO: Record<string, string> = {
  conjunction: "слушать, что складывается заново, вместо того чтобы тянуть старую версию",
  sextile: "сделать маленький конкретный шаг: окно само не откроется",
  trine: "успеть сейчас: через несколько недель это снова будет стоить усилий",
  square: "спросить, какая конкретно часть устарела, и обновить её точечно",
  opposition: "искать третий вариант, где помещаются оба полюса",
};

const MONTHS_RU_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS_RU_SHORT[d.getUTCMonth()]}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// Keep list order (strongest first) while dropping repeats and capping length.
function uniqCap(items: string[], cap = 4): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (it && !out.includes(it)) out.push(it);
    if (out.length >= cap) break;
  }
  return out;
}

export function buildSphereDigest(
  roman: string,
  meaning: string,
  activesIn: DigestTransit[],
  upsIn: DigestUpcoming[],
): SphereDigest {
  const actives = [...activesIn].sort((a, b) => b.strength - a.strength);
  const ups = [...upsIn].sort(
    (a, b) => (a.daysToStart ?? 9999) - (b.daysToStart ?? 9999),
  );
  const flow = actives.filter(isFlow);
  const tense = actives.filter(isTension);

  // ---- shift: what the sphere as a whole is doing
  const n = actives.length;
  let shift: string;
  if (n === 0) {
    shift =
      ups.length > 0
        ? `${roman} дом · ${meaning}. Сейчас здесь тихо: живых транзитов нет, ${ups.length} ${plural(ups.length, "подходит", "подходят", "подходят")}.`
        : `${roman} дом · ${meaning}. Сейчас здесь пусто.`;
  } else {
    const top = actives[0];
    const mix =
      tense.length === 0
        ? "всё на поток, трения нет"
        : flow.length === 0
        ? "всё на трение, лёгких нет"
        : `${flow.length} на поток, ${tense.length} на трение`;
    const until = top.exitsOrb ? `, до ${fmtDate(top.exitsOrb)}` : ", долгосрочный";
    shift =
      `${roman} дом · ${meaning}. ${n} ${plural(n, "транзит", "транзита", "транзитов")}: ${mix}. ` +
      `Ведёт ${top.transitRu} ${top.aspectRu} ${top.natalRu}${until}.`;
    if (n >= 3) {
      shift +=
        " Несколько сразу в одном доме это не набор мелочей, а давление на одну тему.";
    }
  }

  // ---- expect: what is opening, plus what is still on its way
  const expect = uniqCap([
    ...flow.map((t) => PLANET_BRINGS[t.transitName] ?? ""),
    ...ups.map((u) =>
      u.daysToStart != null
        ? `через ${u.daysToStart} ${plural(u.daysToStart, "день", "дня", "дней")} подойдёт ${u.transitRu} ${u.aspectRu} ${u.natalRu}`
        : `подходит ${u.transitRu} ${u.aspectRu} ${u.natalRu}`,
    ),
  ]);

  // ---- beware: only from what is actually pressing
  const beware = uniqCap(tense.map((t) => PLANET_RISK[t.transitName] ?? ""));

  // ---- do: planet actions from the flowing side, plus how to walk the tension
  const doNow = uniqCap([
    ...flow.map((t) => PLANET_DO[t.transitName] ?? ""),
    ...(tense.length > 0 ? [ASPECT_DO[tense[0].aspectName] ?? ""] : []),
    ...(flow.length > 0 && tense.length === 0
      ? [ASPECT_DO[flow[0].aspectName] ?? ""]
      : []),
  ]);

  // ---- don't
  const dont = uniqCap(tense.map((t) => PLANET_DONT[t.transitName] ?? ""));

  return { shift, expect, beware, doNow, dont };
}
