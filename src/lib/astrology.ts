import { Body, Ecliptic, GeoVector, MakeTime } from "astronomy-engine";
import { PERSON } from "./person";
import { placidusCusps } from "./placidus";

/**
 * Natal data for whoever this deployment is for. The chart itself lives in
 * `src/people/`, one file per person, selected by NEXT_PUBLIC_PERSON. Nothing
 * else in the codebase knows whose chart it is drawing.
 */
export const NATAL = {
  date: new Date(PERSON.birthUTC),
  lat: PERSON.lat,
  lon: PERSON.lon,
};

/**
 * Placidus cusps, degrees of ecliptic longitude, house I first. Solved from the
 * birth data rather than typed in, so a new person costs no hand computation
 * and cannot inherit someone else's houses. See `placidus.ts` for the two
 * conventions that are easy to get wrong.
 */
export const NATAL_CUSPS = placidusCusps(NATAL.date, NATAL.lat, NATAL.lon);

/** Which natal house a longitude falls in, by the real cusps. */
export function houseOfLongitude(lon: number): number {
  const l = ((lon % 360) + 360) % 360;
  for (let h = 0; h < 12; h++) {
    const from = NATAL_CUSPS[h];
    const to = NATAL_CUSPS[(h + 1) % 12];
    const span = ((to - from) % 360 + 360) % 360;
    if (((l - from) % 360 + 360) % 360 < span) return h + 1;
  }
  return 1;
}

export const ZODIAC_SIGNS_RU = [
  "Овен",
  "Телец",
  "Близнецы",
  "Рак",
  "Лев",
  "Дева",
  "Весы",
  "Скорпион",
  "Стрелец",
  "Козерог",
  "Водолей",
  "Рыбы",
] as const;

export const ZODIAC_GLYPHS = ["♈︎", "♉︎", "♊︎", "♋︎", "♌︎", "♍︎", "♎︎", "♏︎", "♐︎", "♑︎", "♒︎", "♓︎"] as const;

export const BODIES = [
  { body: Body.Sun, name: "Sun", nameRu: "Солнце", glyph: "☉" },
  { body: Body.Moon, name: "Moon", nameRu: "Луна", glyph: "☽" },
  { body: Body.Mercury, name: "Mercury", nameRu: "Меркурий", glyph: "☿" },
  { body: Body.Venus, name: "Venus", nameRu: "Венера", glyph: "♀" },
  { body: Body.Mars, name: "Mars", nameRu: "Марс", glyph: "♂" },
  { body: Body.Jupiter, name: "Jupiter", nameRu: "Юпитер", glyph: "♃" },
  { body: Body.Saturn, name: "Saturn", nameRu: "Сатурн", glyph: "♄" },
  { body: Body.Uranus, name: "Uranus", nameRu: "Уран", glyph: "⛢" },
  { body: Body.Neptune, name: "Neptune", nameRu: "Нептун", glyph: "♆" },
  { body: Body.Pluto, name: "Pluto", nameRu: "Плутон", glyph: "♇" },
] as const;

export type BodyInfo = (typeof BODIES)[number];

export type Position = {
  body: BodyInfo;
  longitude: number;
  sign: string;
  signGlyph: string;
  degreeInSign: number;
  house: number;
  houseMeaning: string;
};

function longitudeFor(body: Body, date: Date): number {
  const t = MakeTime(date);
  const eq = GeoVector(body, t, true);
  const ecl = Ecliptic(eq);
  return ((ecl.elon % 360) + 360) % 360;
}

/** English body name to Russian, for sentences composed at runtime. */
const BODY_RU: Record<string, string> = Object.fromEntries(
  BODIES.map((b) => [b.name, b.nameRu])
);

export function computePositions(date: Date): Position[] {
  return BODIES.map((b) => {
    const longitude = longitudeFor(b.body, date);
    const signIdx = Math.floor(longitude / 30);
    const sign = ZODIAC_SIGNS_RU[signIdx];
    const house = houseOfLongitude(longitude);
    return {
      body: b,
      longitude,
      sign,
      signGlyph: ZODIAC_GLYPHS[signIdx],
      degreeInSign: longitude - signIdx * 30,
      house,
      houseMeaning: HOUSE_MEANING_RU[house] ?? "",
    };
  });
}

const ASPECTS = [
  { name: "conjunction", nameRu: "соединение", angle: 0, symbol: "☌" },
  { name: "sextile", nameRu: "секстиль", angle: 60, symbol: "⚹" },
  { name: "square", nameRu: "квадрат", angle: 90, symbol: "□" },
  { name: "trine", nameRu: "тригон", angle: 120, symbol: "△" },
  { name: "opposition", nameRu: "оппозиция", angle: 180, symbol: "☍" },
] as const;

export type AspectDef = (typeof ASPECTS)[number];

export type Aspect = {
  transit: Position;
  natal: Position;
  aspect: AspectDef;
  orb: number;
  meaning: string;
  /** Imperative: where to put energy. Rendered separately from the context. */
  action: string;
  entersOrb: Date | null;
  exitsOrb: Date | null;
  strength: number; // 0..100
  strengthTier: "strong" | "notable" | "mild";
};

/**
 * Score a transit by weight of the bodies, aspect hardness, orb tightness, and natal point priority.
 * Returns a 0..100 score.
 */
/** Shared by the transit score and the sky-aspect score, so the two numbers
    stay on one scale and cannot drift apart. */
const BODY_WEIGHT: Record<string, number> = {
  Pluto: 25, Neptune: 22, Uranus: 22, Saturn: 22, Jupiter: 18,
  Sun: 16, Mars: 14, Venus: 12, Mercury: 10, Moon: 6,
};
const ASPECT_WEIGHT: Record<string, number> = {
  conjunction: 20, opposition: 18, square: 16, trine: 12, sextile: 10,
};

function scoreTransit(
  transitBody: string,
  aspectName: string,
  natalBody: string,
  orb: number
): number {
  const orbScore = ((3 - orb) / 3) * 40; // 0..40
  const natalPriority: Record<string, number> = {
    Sun: 15, Moon: 15, Mercury: 10, Venus: 10, Mars: 10,
    Jupiter: 8, Saturn: 8, Uranus: 6, Neptune: 6, Pluto: 6,
  };
  return Math.round(
    orbScore + (BODY_WEIGHT[transitBody] ?? 10) + (ASPECT_WEIGHT[aspectName] ?? 10) + (natalPriority[natalBody] ?? 8)
  );
}

function strengthTier(score: number): "strong" | "notable" | "mild" {
  if (score >= 75) return "strong";
  if (score >= 60) return "notable";
  return "mild";
}

function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function orbBetween(transitBody: Body, natalLongitude: number, aspectAngle: number, date: Date): number {
  const diff = angularDiff(longitudeFor(transitBody, date), natalLongitude);
  return Math.abs(diff - aspectAngle);
}

/** Max orb a transit is considered to be inside, and the width of a ribbon window. */
export const TRANSIT_ORB = 3;

/**
 * How tight the aspect is at each of `samples` moments evenly spaced across a
 * window, as 0..1 where 1 is exact. Not renormalised per transit on purpose: a
 * transit that turns around at two degrees and never closes should look weaker
 * along its whole length than one that goes partile, and renormalising would
 * hide exactly that. Retrograde passes come out as several bright spots, which
 * is what actually happens.
 */
export function orbProfile(
  transitBodyName: string,
  natalLongitude: number,
  aspectAngle: number,
  fromMs: number,
  toMs: number,
  samples = 24
): number[] {
  const body = BODIES.find((b) => b.name === transitBodyName)?.body;
  if (!body || toMs <= fromMs) return new Array(samples).fill(1);
  const out: number[] = [];
  for (let i = 0; i < samples; i++) {
    const at = new Date(fromMs + ((toMs - fromMs) * i) / (samples - 1));
    const orb = orbBetween(body, natalLongitude, aspectAngle, at);
    out.push(Math.min(1, Math.max(0, (TRANSIT_ORB - orb) / TRANSIT_ORB)));
  }
  return out;
}

/** The moment inside a window when the aspect is tightest. */
export function peakOfWindow(
  transitBodyName: string,
  natalLongitude: number,
  aspectAngle: number,
  fromMs: number,
  toMs: number
): number {
  const body = BODIES.find((b) => b.name === transitBodyName)?.body;
  if (!body || toMs <= fromMs) return (fromMs + toMs) / 2;
  // Coarse pass then a daily refine around the winner. A slow transit's window
  // runs for months, and sampling every day of it cost more than the whole
  // ribbon scan for an answer that moves by hours.
  const DAY_MS = 86400000;
  const scan = (step: number, lo: number, hi: number) => {
    let best = lo;
    let bestOrb = Infinity;
    for (let at = lo; at <= hi; at += step) {
      const orb = orbBetween(body, natalLongitude, aspectAngle, new Date(at));
      if (orb < bestOrb) {
        bestOrb = orb;
        best = at;
      }
    }
    return best;
  };
  const coarse = scan(4 * DAY_MS, fromMs, toMs);
  return scan(DAY_MS, Math.max(fromMs, coarse - 4 * DAY_MS), Math.min(toMs, coarse + 4 * DAY_MS));
}

function findBoundary(
  transitBody: Body,
  natalLongitude: number,
  aspectAngle: number,
  fromDate: Date,
  direction: 1 | -1,
  maxDays: number,
  maxOrb: number
): Date | null {
  const dayMs = 1000 * 60 * 60 * 24;
  for (let d = 1; d <= maxDays; d++) {
    const testDate = new Date(fromDate.getTime() + direction * d * dayMs);
    const orb = orbBetween(transitBody, natalLongitude, aspectAngle, testDate);
    if (orb > maxOrb) {
      // Boundary is between d-1 and d; return d as approximate
      return new Date(fromDate.getTime() + direction * d * dayMs);
    }
  }
  return null;
}

/**
 * What to actually do. Kept apart from `meaningFor` on purpose: the meaning
 * explains, the action instructs, and the panel renders them differently.
 */
const ACTIONS: Record<string, string> = {
  "Jupiter-sextile-Venus": "Вложись в себя: учёба, портфолио, внешность. Первый шаг за тобой, само не придёт.",
  "Jupiter-trine-Venus": "Начинай то, что требует чужого «да». Бюджет при этом держи прежний.",
  "Jupiter-square-Venus": "Пауза перед любой крупной тратой и любым обещанием.",
  "Jupiter-conjunction-Sun": "Бери новое, но на одну вещь меньше, чем хочется.",
  "Saturn-square-Uranus": "Переделывай по одной рамке за раз, и только там, где реально жмёт.",
  "Saturn-conjunction-Sun": "Укрепляй то, что уже работает. Новое пока не начинай.",
  "Saturn-square-Sun": "Сократи список до одного дела и доведи его до конца.",
  "Uranus-trine-Sun": "Пробуй новое: людей, форматы, направления. Окно короткое.",
  "Uranus-square-Sun": "Меняй малым: один эксперимент в неделю вместо одного большого решения.",
  "Pluto-square-Sun": "Не защищай старое описание себя. Замечай, что в нём уже неправда.",
  "Neptune-sextile-Mercury": "Пиши, рисуй, придумывай. Отчёты и цифры отложи.",
  "Neptune-square-Mercury": "Ничего не подписывай. Важное перечитай на свежую голову.",
  "Mars-conjunction-Sun": "Запускай и двигай телом. Терпеливые разговоры перенеси.",
  "Mars-square-Uranus": "Сутки на подумать перед любым резким шагом.",
  "Mercury-square-Uranus": "Записывай идеи, но детали перепроверь дважды.",
  "Saturn-conjunction-Mars": "Один точный шаг вместо десяти. И пауза перед реакцией.",
  "Uranus-square-Moon": "Назови, какая именно опора устарела, и поменяй только её.",
  "Sun-trine-Neptune": "Доведи полуготовое творческое до состояния «можно показать».",
  "Pluto-trine-Mercury": "Копай вглубь: исследование, длинный текст, разговор по сути.",
  "Mercury-sextile-Moon": "Проговори то, что копилось. Дневник или прямой разговор.",
};

export function actionFor(transitBody: string, aspectName: string, natalBody: string): string {
  const specific = ACTIONS[`${transitBody}-${aspectName}-${natalBody}`];
  if (specific) return specific;
  const generic: Record<string, string> = {
    conjunction: "Не тяни назад «как было». Слушай, что хочет начаться.",
    sextile: "Сделай один конкретный шаг в эту тему, пока окно открыто.",
    trine: "Пользуйся сейчас: через пару недель то же самое снова потребует усилий.",
    square: "Не ломай и не убегай. Найди, какая одна часть устарела, и обнови точечно.",
    opposition: "Не выбирай один полюс. Ищи третий вариант, где помещаются оба.",
  };
  return generic[aspectName] ?? "";
}

/**
 * Russian meaning for a transit+aspect+natal combination.
 * Structure: (1) what's the energy, (2) what it looks like in daily life,
 * (3) micro-nudge — что сделать или чего избежать.
 * Falls back to a generic aspect meaning if no specific pair is defined.
 */
function meaningFor(
  transitBody: string,
  aspectName: string,
  natalBody: string,
  mode: "natal" | "sky" = "natal"
): string {
  const key = `${transitBody}-${aspectName}-${natalBody}`;
  const specific: Record<string, string> = {
    "Jupiter-sextile-Venus":
      "Юпитер расширяет то, чего касается Венера: деньги, отношения, эстетика, тело. Открывается окно для вложений в себя. Учёба, красота, портфолио, долгосрочные покупки. Секстиль даёт возможность, но не приносит. Нужно сделать первый шаг.",
    "Jupiter-trine-Venus":
      "Лёгкий поток любви и денег. Люди тянутся, предложения приходят сами. Хорошо начинать, но не перерасходовать. Юпитер склонен переоценивать масштаб.",
    "Jupiter-square-Venus":
      "Соблазн перебрать: в тратах, удовольствиях, обещаниях. Хочется сразу всего и побольше. Пауза перед покупкой или обязательством спасёт.",
    "Jupiter-conjunction-Sun":
      "Годичный цикл личного роста. Уверенность на пике, открываются возможности, которых раньше не было. Риск переоценить свои силы и взять больше, чем потянешь.",
    "Saturn-square-Uranus":
      "Макро-квадрат: структура против свободы. На работе или в отношениях ощущаешь, что рамки жмут, но ломать небезопасно. Не революция, а медленная перестройка там, где реально тесно.",
    "Saturn-conjunction-Sun":
      "Проверка зрелости на 2-3 года. То, что строилось на слабом фундаменте, сыплется. То, что на сильном, укрепляется. Нагрузка реальная, но это не наказание, а калибровка.",
    "Saturn-square-Sun":
      "Ограничения и ответственность. Кажется, что ничего не движется, но это тест. Ты учишься делать меньше лучше. Форсить бесполезно.",
    "Uranus-trine-Sun":
      "Свежий воздух в идентичность. Приходят идеи, люди, возможности, которые сдвигают траекторию. Мягко, без кризиса. Хорошее время экспериментировать.",
    "Uranus-square-Sun":
      "Резкий поворот просится наружу. Хочется сломать привычки, сменить работу или стиль. Не спеши решать за один день. Лучше начать с малых экспериментов.",
    "Pluto-square-Sun":
      "Глубокая перестройка идентичности. То, кем ты привыкла себя считать, не работает в новой ситуации. Сильный, долгий транзит. Перерождаешься постепенно.",
    "Neptune-sextile-Mercury":
      "Интуитивное мышление в фаворе. Творческие идеи приходят без усилия, хорошо писать, рисовать, придумывать. Факты и логика не сейчас.",
    "Neptune-square-Mercury":
      "Туман в голове, сложно ясно думать и формулировать. Не лучший период подписывать контракты и принимать важные решения. Перепроверяй всё дважды.",
    "Mars-conjunction-Sun":
      "Годичный всплеск энергии и инициативы. Тело хочет действовать, не сидеть. Отлично для запуска и проектов, плохо для терпеливых диалогов.",
    "Mars-square-Uranus":
      "Импульс плюс breakthrough равно риск действий сгоряча. Хочется прямо сейчас сломать и сделать иначе. Перед резкими шагами нужны 24 часа на подумать.",
    "Mercury-square-Uranus":
      "Быстрые неожиданные мысли и разговоры. Что-то прояснится внезапно: письмо, идея, инсайт. Параллельно рассеянность и ошибки в деталях.",
    "Saturn-conjunction-Mars":
      "Сатурн жмёт натальный Марс — твою способность действовать и злиться. На несколько месяцев энергия идёт через сито: желания сильные, но реализация упирается, реакции тише обычного. Это не блок, это калибровка. Учишься делать меньше, но точнее. Форсировать размашистым бесполезно — лучше пауза перед реакцией и точечный шаг вместо ста.",
    "Uranus-square-Moon":
      "Уран дёргает натальную Луну — твои привычки, эмоциональные опоры, ощущение «дома». Перепады настроения становятся резче, хочется вырваться из рутины, ломать привычные паттерны. Не торопись менять всё разом. Спроси: какая конкретно опора устарела? Малые эксперименты лучше большой ломки.",
    "Sun-trine-Neptune":
      "Солнце мягко открывает доступ к натальному Нептуну — творчество, воображение, интуиция работают без усилия. Хорошее окно для арт-практик, мечтаний, эстетики. Логика и таблицы не сейчас. Если есть что-то полу-готовое креативное — сейчас день довести до состояния, когда можно показать.",
    "Pluto-trine-Mercury":
      "Плутон в гармонии с натальным Меркурием — мышление углубляется, тянет к настоящим темам, а не к мелочам. Хорошо для исследования, текстов, разговоров «по сути». Поверхностный smalltalk вызывает усталость. Это многолетний транзит, не торопи прозрения — они будут приходить сами.",
    "Mercury-sextile-Moon":
      "Меркурий помогает выразить чувства натальной Луны — то, что внутри было размыто, можно сформулировать. Хорошо писать дневник, говорить с близким человеком, делать ясные «я-сообщения». Если что-то копилось — сейчас короткое окно проговорить без накала.",
  };
  if (specific[key]) return specific[key];

  // Fallback: build a sentence from the transit body's role × natal body's theme × aspect type
  const transitRole: Record<string, string> = {
    Sun: "освещает и активирует",
    Moon: "подсвечивает эмоционально",
    Mercury: "включает разговор про",
    Venus: "смягчает и притягивает",
    Mars: "заряжает",
    Jupiter: "расширяет и открывает",
    Saturn: "структурирует и проверяет",
    Uranus: "сотрясает и освобождает",
    Neptune: "размывает и одухотворяет",
    Pluto: "перестраивает на глубине",
  };

  const natalTheme: Record<string, string> = {
    Sun: "твою идентичность и жизненный стержень",
    Moon: "эмоции и базовые привычки",
    Mercury: "мышление и то, как ты говоришь",
    Venus: "отношения, удовольствие, деньги, эстетику",
    Mars: "энергию, импульс, способность действовать",
    Jupiter: "рост и веру в большее",
    Saturn: "структуру и зону ответственности",
    Uranus: "свободу и потребность в перемене",
    Neptune: "мечты, воображение, тонкое восприятие",
    Pluto: "тему власти и глубокой трансформации",
  };

  const aspectFlavor: Record<string, { feel: string; doit: string }> = {
    conjunction: {
      feel: "Это начало нового цикла — старая версия темы заканчивается, складывается новая.",
      doit: "Не пытайся сейчас «вернуть как было». Слушай, что хочет родиться.",
    },
    sextile: {
      feel: "Это рабочая возможность — не разворачивается сама, но если подхватить, идёт легко.",
      doit: "Сделай маленький конкретный шаг в эту тему — окно открыто.",
    },
    trine: {
      feel: "Это лёгкий поток — сопротивления нет, тема даётся почти даром.",
      doit: "Не упускай: то, что сейчас легко, через несколько недель снова будет требовать усилий.",
    },
    square: {
      feel: "Это трение — что-то требует пересмотра, но через дискомфорт.",
      doit: "Не ломай и не убегай. Спроси: какая конкретно часть устарела и как её обновить точечно.",
    },
    opposition: {
      feel: "Это перетягивание каната между двумя полюсами — обе стороны хотят твоего внимания.",
      doit: "Не выбирай одну, ищи третий вариант, где обе помещаются.",
    },
  };

  // In the sky both planets are moving, so nothing is "натальное" and the second
  // person is wrong: this is weather, not something happening to her.
  const skyTheme: Record<string, string> = {
    Sun: "витальность и то, что в центре",
    Moon: "эмоции и привычный ритм",
    Mercury: "мышление, речь, переговоры",
    Venus: "отношения, удовольствие, деньги, вкус",
    Mars: "энергию и способность действовать",
    Jupiter: "рост и масштаб",
    Saturn: "структуру и ответственность",
    Uranus: "свободу и потребность в перемене",
    Neptune: "воображение и тонкое восприятие",
    Pluto: "власть и глубокую перестройку",
  };
  // Sky verbs are their own table: every one of them has to take a plain object,
  // because in sky mode the theme follows immediately. The natal table used to
  // hold two verbs that ended in a complement ("подталкивает к действию",
  // "разговор вокруг"), and the sentence came out ungrammatical in both modes.
  const skyRole: Record<string, string> = {
    Sun: "освещает",
    Moon: "подсвечивает",
    Mercury: "включает разговор про",
    Venus: "смягчает",
    Mars: "разгоняет",
    Jupiter: "расширяет",
    Saturn: "проверяет на прочность",
    Uranus: "встряхивает",
    Neptune: "размывает",
    Pluto: "перестраивает",
  };
  const role = (mode === "sky" ? skyRole[transitBody] : transitRole[transitBody]) ?? "касается";
  const theme =
    (mode === "sky" ? skyTheme[natalBody] : natalTheme[natalBody]) ?? "натальную тему";
  const flavor = aspectFlavor[aspectName];
  const opener =
    mode === "sky"
      ? `${BODY_RU[transitBody] ?? transitBody} ${role} ${theme}.`
      : `${transitBody === natalBody ? "Эта планета" : "Транзитная планета"} ${role} ${theme}.`;
  const middle = flavor?.feel ?? "";
  const closing = flavor?.doit ?? "";
  return [opener, middle, closing].filter(Boolean).join(" ");
}

export function computeTransits(transitDate: Date = new Date(), maxOrb = 3): Aspect[] {
  const transitPositions = computePositions(transitDate);
  const natalPositions = computePositions(NATAL.date);

  const results: Aspect[] = [];

  for (const transit of transitPositions) {
    for (const natal of natalPositions) {
      if (transit.body.name === natal.body.name) continue;

      const diff = angularDiff(transit.longitude, natal.longitude);
      for (const aspect of ASPECTS) {
        const orb = Math.abs(diff - aspect.angle);
        if (orb <= maxOrb) {
          // Find when this aspect enters and exits 3° orb.
          // Fast bodies = sample up to 30 days; slow bodies = up to 730 days (2y).
          const maxDays = ["Sun", "Moon", "Mercury", "Venus", "Mars"].includes(transit.body.name) ? 30 : 730;

          const entersOrb = findBoundary(transit.body.body, natal.longitude, aspect.angle, transitDate, -1, maxDays, maxOrb);
          const exitsOrb = findBoundary(transit.body.body, natal.longitude, aspect.angle, transitDate, 1, maxDays, maxOrb);

          const strength = scoreTransit(transit.body.name, aspect.name, natal.body.name, orb);
          results.push({
            transit,
            natal,
            aspect,
            orb,
            meaning: meaningFor(transit.body.name, aspect.name, natal.body.name),
            action: actionFor(transit.body.name, aspect.name, natal.body.name),
            entersOrb,
            exitsOrb,
            strength,
            strengthTier: strengthTier(strength),
          });
        }
      }
    }
  }

  return results.sort((a, b) => a.orb - b.orb);
}

/** What each body is about, in one word. */
/**
 * A sky aspect read against this particular chart.
 *
 * Two planets meeting overhead is the same event for everybody. What makes it
 * hers is where those two are standing in her houses, and whether either of them
 * is touching one of her natal points at the same moment. The score is built on
 * the same weight tables as the transit score, so the two numbers can sit next
 * to each other and mean roughly the same thing:
 *
 *   орб 0..30 · пара планет 0..25 · тип аспекта 0..20 · зацепка за натал 0..25
 *
 * With no natal contact the last term is zero, and a sky aspect tops out around
 * 75. That is the honest answer: it is happening, but not to her in particular.
 */
export type SkyAspectReading = {
  strength: number;
  houses: [number, number];
  /** Her strongest natal contact made by either of the two bodies today. */
  hook: Aspect | null;
  /** One word for the aspect's character. */
  word: string;
  /** One clause for what it touches. */
  brief: string;
};

export function readSkyAspect(
  aName: string,
  aGeoLon: number,
  bName: string,
  bGeoLon: number,
  aspectName: string,
  orb: number,
  maxOrb: number,
  date: Date = new Date()
): SkyAspectReading {
  const hook =
    computeTransits(date)
      .filter((t) => t.transit.body.name === aName || t.transit.body.name === bName)
      .sort((x, y) => y.strength - x.strength)[0] ?? null;

  const strength = Math.round(
    ((maxOrb - orb) / maxOrb) * 30 +
      ((BODY_WEIGHT[aName] ?? 10) + (BODY_WEIGHT[bName] ?? 10)) / 2 +
      (ASPECT_WEIGHT[aspectName] ?? 10) +
      (hook ? (hook.strength / 100) * 25 : 0)
  );

  return {
    strength,
    houses: [houseOfLongitude(aGeoLon), houseOfLongitude(bGeoLon)],
    hook,
    // First clause only. The card is read at a glance while the pointer is on a
    // chord; the paragraph that fits the timeline was a wall here.
    brief: meaningFor(aName, aspectName, bName, "sky").split(". ")[0],
    word: ASPECT_WORD_RU[aspectName] ?? "",
  };
}

/**
 * The one-word character of an aspect. The dial card is a glance, not a read:
 * the full paragraph belongs on the timeline, where there is room and a reason.
 */
export const ASPECT_WORD_RU: Record<string, string> = {
  conjunction: "слияние",
  sextile: "возможность",
  trine: "поток",
  square: "трение",
  opposition: "перетягивание",
};

export const BODY_ROLE_RU: Record<string, string> = {
  Sun: "витальность",
  Moon: "эмоции",
  Mercury: "мышление",
  Venus: "любовь и ценности",
  Mars: "действие",
  Jupiter: "рост",
  Saturn: "структура",
  Uranus: "перемены",
  Neptune: "интуиция",
  Pluto: "трансформация",
};

export type TransitCluster = {
  house: number;
  transits: Aspect[];
  totalStrength: number;
  synthesis: string;
  clusterStart: Date | null;
  clusterEnd: Date | null;
};

function clusterSynthesis(house: number, transits: Aspect[]): string {
  const houseMeaning = HOUSE_MEANING_RU[house] ?? "";
  const roles = [...new Set(transits.map((t) => BODY_ROLE_RU[t.transit.body.name] ?? t.transit.body.nameRu))];
  const rolesStr = roles.join(", ");
  const tenseCount = transits.filter((t) => ["square", "opposition"].includes(t.aspect.name)).length;
  const harmoniousCount = transits.filter((t) => ["trine", "sextile"].includes(t.aspect.name)).length;
  const conjCount = transits.filter((t) => t.aspect.name === "conjunction").length;

  if (conjCount >= 2)
    return `${rolesStr} — всё сходится в одной точке. Тема «${houseMeaning}» под максимальным фокусом. Период концентрированных изменений.`;
  if (tenseCount > 0 && harmoniousCount > 0)
    return `${rolesStr} активны в теме «${houseMeaning}» одновременно. Трение и возможность идут параллельно — есть куда двигаться, но без форсирования.`;
  if (tenseCount >= 2)
    return `${rolesStr} создают высокое трение в теме «${houseMeaning}». Не кризис, а калибровка — что-то перестраивается. Не торопи решения.`;
  if (harmoniousCount >= 2)
    return `${rolesStr} открывают поток в теме «${houseMeaning}». Двойная поддержка — хорошее окно, чтобы действовать в этой области.`;
  return `${rolesStr} активируют тему «${houseMeaning}» с разных сторон одновременно. Фокус и внимание.`;
}

export function transitClusters(date: Date = new Date(), minCount = 2): TransitCluster[] {
  const all = computeTransits(date).filter((a) => a.transit.body.name !== "Moon");

  const byHouse = new Map<number, Aspect[]>();
  for (const t of all) {
    const h = t.natal.house;
    if (h === 0) continue;
    if (!byHouse.has(h)) byHouse.set(h, []);
    byHouse.get(h)!.push(t);
  }

  const clusters: TransitCluster[] = [];
  for (const [house, transits] of byHouse) {
    if (transits.length < minCount) continue;
    const sorted = transits.sort((a, b) => b.strength - a.strength);
    const totalStrength = sorted.reduce((s, t) => s + t.strength, 0);

    const starts = sorted.map((t) => t.entersOrb).filter(Boolean) as Date[];
    const ends = sorted.map((t) => t.exitsOrb).filter(Boolean) as Date[];
    const clusterStart = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null;
    const clusterEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;

    clusters.push({ house, transits: sorted, totalStrength, synthesis: clusterSynthesis(house, sorted), clusterStart, clusterEnd });
  }

  return clusters.sort((a, b) => b.totalStrength - a.totalStrength);
}

export function notableTransits(transitDate: Date = new Date(), limit = 5, includeMoon = false): Aspect[] {
  const all = computeTransits(transitDate);
  return all
    .filter((a) => includeMoon || a.transit.body.name !== "Moon")
    .filter((a) => !a.exitsOrb || a.exitsOrb.getTime() > transitDate.getTime())
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

export const HOUSE_ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI",
  7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII",
};

export const HOUSE_EMOJI: Record<number, string> = {
  1: "🪞", 2: "💰", 3: "💬", 4: "🏠", 5: "🎪", 6: "🧺",
  7: "👯", 8: "🦂", 9: "✈️", 10: "🏛️", 11: "🛸", 12: "🌊",
};

/**
 * Tone of an aspect. Sextile and trine flow, square and opposition grind.
 * Conjunction stays neutral: its tone depends on which bodies meet, not on the angle.
 */
export type AspectTone = "positive" | "negative" | "neutral";

export function aspectTone(name: string): AspectTone {
  if (name === "sextile" || name === "trine") return "positive";
  if (name === "square" || name === "opposition") return "negative";
  return "neutral";
}

/** Colour per tone. Turquoise is already the harmonious colour in UpcomingTransitsPanel. */
export const ASPECT_TONE_COLOR: Record<AspectTone, string> = {
  positive: "#4db8b0",
  // Lightness-matched to the other two, so a square never looks heavier than a
  // trine of the same strength just because its hue is darker.
  negative: "var(--aspect-negative)",
  neutral: "#8b7fa8",
};

/**
 * The same three tones for the transit layer: hue kept, saturation pulled back,
 * lightness lifted. The dashed threads over the natal wheel are today's sky, a
 * different layer from her chart, and at identical colour the dashes read as one
 * drawing in two line styles rather than as two layers.
 */
export const ASPECT_TONE_COLOR_TRANSIT: Record<AspectTone, string> = {
  positive: "var(--aspect-positive-transit)",
  negative: "var(--aspect-negative-transit)",
  neutral: "var(--aspect-neutral-transit)",
};

export const ASPECT_TONE_TEXT: Record<AspectTone, string> = {
  positive: "#4db8b0",
  negative: "var(--negative)",
  neutral: "var(--muted)",
};

export function toRoman(n: number): string {
  return HOUSE_ROMAN[n] ?? String(n);
}

export function houseLabel(n: number): string {
  const emoji = HOUSE_EMOJI[n] ?? "";
  const roman = HOUSE_ROMAN[n] ?? String(n);
  return `${roman} ${emoji}`;
}

export const HOUSE_MEANING_RU: Record<number, string> = {
  1: "личность, начало, внешний вид",
  2: "деньги, ресурсы, тело",
  3: "коммуникация, ближний круг",
  4: "дом, семья, корни",
  5: "творчество, дети, любовь",
  6: "работа, рутины, здоровье",
  7: "партнёрство, отношения",
  8: "трансформация, общие ресурсы",
  9: "философия, путешествия, учёба",
  10: "карьера, статус, публичное",
  11: "сообщество, будущее, цели",
  12: "подсознание, уединение",
};

export type UpcomingAspect = {
  transitBody: BodyInfo;
  transitHouseAtEntry: number;
  natal: Position;
  aspect: AspectDef;
  entersOrb: Date;
  strength: number;
  strengthTier: "strong" | "notable" | "mild";
  meaning: string;
  action: string;
};

/**
 * Find transits not yet in orb that will become active within maxDays.
 * Scans slow+mid planets against personal natal planets.
 */
export function upcomingTransits(fromDate: Date = new Date(), limit = 6, maxDays = 365): UpcomingAspect[] {
  const SCAN_STEP_DAYS = 5;
  const dayMs = 1000 * 60 * 60 * 24;
  const MAX_ORB = 3;

  const transitBodies = BODIES.filter((b) =>
    ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Mars"].includes(b.name)
  );
  const natalPositions = computePositions(NATAL.date);
  const personalNatal = natalPositions.filter((p) =>
    ["Sun", "Moon", "Mercury", "Venus", "Mars"].includes(p.body.name)
  );

  const results: UpcomingAspect[] = [];

  for (const tb of transitBodies) {
    for (const natal of personalNatal) {
      if (tb.name === natal.body.name) continue;
      for (const aspect of ASPECTS) {
        const currentOrb = orbBetween(tb.body, natal.longitude, aspect.angle, fromDate);
        if (currentOrb <= MAX_ORB) continue; // already active

        let prevOrb = currentOrb;
        let entryDate: Date | null = null;

        for (let d = SCAN_STEP_DAYS; d <= maxDays; d += SCAN_STEP_DAYS) {
          const testDate = new Date(fromDate.getTime() + d * dayMs);
          const orb = orbBetween(tb.body, natal.longitude, aspect.angle, testDate);
          if (orb <= MAX_ORB && prevOrb > MAX_ORB) {
            entryDate = new Date(fromDate.getTime() + (d - SCAN_STEP_DAYS) * dayMs);
            break;
          }
          prevOrb = orb;
        }

        if (entryDate) {
          const strength = scoreTransit(tb.name, aspect.name, natal.body.name, MAX_ORB);
          const entryLon = longitudeFor(tb.body, entryDate);
          const transitHouseAtEntry = houseOfLongitude(entryLon);
          results.push({
            transitBody: tb,
            transitHouseAtEntry,
            natal,
            aspect,
            entersOrb: entryDate,
            strength,
            strengthTier: strengthTier(strength),
            meaning: meaningFor(tb.name, aspect.name, natal.body.name),
            action: actionFor(tb.name, aspect.name, natal.body.name),
          });
        }
      }
    }
  }

  return results
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

/**
 * For the moon panel: the sign + house each lunar event will be in.
 */
export function moonPositionAt(date: Date): {
  sign: string;
  signGlyph: string;
  house: number;
  houseMeaning: string;
} {
  const lon = longitudeFor(Body.Moon, date);
  const signIdx = Math.floor(lon / 30);
  const sign = ZODIAC_SIGNS_RU[signIdx];
  const house = houseOfLongitude(lon);
  return {
    sign,
    signGlyph: ZODIAC_GLYPHS[signIdx],
    house,
    houseMeaning: HOUSE_MEANING_RU[house] ?? "",
  };
}
