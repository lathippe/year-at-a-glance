// Abstract marks for the twelve houses — the life spheres a transit lands in.
//
// Emoji were doing this job before (✈️ 🏠 🎪 🏛️). They read as stickers next to
// a chart, they never match the weight of the surrounding type, and each vendor
// draws them differently. These are one geometric system instead, on a shared
// 16×16 grid with one stroke weight, so a row of them reads as a set:
//
//   dot          a being — you, a child, a friend
//   closed shape a ground you stand on — a home, a body, a self
//   line         a relation between two things
//   arc          a horizon: something past the edge of the current ground
//   repetition   time — a comb of ticks is a rhythm, not an object
//
// They inherit currentColor, so they take the tone of whatever labels them.

type Props = {
  house: number;
  size?: number;
  className?: string;
  title?: string;
};

function paths(house: number) {
  switch (house) {
    // I — я, тело. The origin point: a self, and the boundary around it.
    case 1:
      return (
        <>
          <circle cx="8" cy="8" r="6" />
          <circle cx="8" cy="8" r="2.1" fill="currentColor" stroke="none" />
        </>
      );
    // II — деньги, ресурсы. A pile: what is stacked up and held.
    case 2:
      return (
        <>
          <line x1="3" y1="11.5" x2="13" y2="11.5" />
          <line x1="4.5" y1="8.5" x2="11.5" y2="8.5" />
          <line x1="6" y1="5.5" x2="10" y2="5.5" />
        </>
      );
    // III — связи, обучение. Two channels running both ways: exchange.
    case 3:
      return (
        <>
          <line x1="3" y1="10.5" x2="13" y2="10.5" />
          <circle cx="3" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
          <line x1="3" y1="5.5" x2="13" y2="5.5" />
          <circle cx="13" cy="5.5" r="1.3" fill="currentColor" stroke="none" />
        </>
      );
    // IV — дом, семья, корни. A ground, and the wider floor it rests on.
    case 4:
      return (
        <>
          <rect x="4.5" y="3.5" width="7" height="7" rx="0.6" />
          <line x1="2" y1="13.2" x2="14" y2="13.2" />
        </>
      );
    // V — творчество, дети, любовь. Something radiating out of a point.
    case 5:
      return (
        <>
          <line x1="8" y1="2.5" x2="8" y2="6" />
          <line x1="13" y1="5.5" x2="10" y2="7.4" />
          <line x1="11.2" y1="13" x2="9.4" y2="9.8" />
          <line x1="4.8" y1="13" x2="6.6" y2="9.8" />
          <line x1="3" y1="5.5" x2="6" y2="7.4" />
        </>
      );
    // VI — рутина, работа, здоровье. A rhythm: the same tick, again.
    case 6:
      return (
        <>
          <line x1="2.5" y1="12" x2="13.5" y2="12" />
          <line x1="4" y1="12" x2="4" y2="7" />
          <line x1="7" y1="12" x2="7" y2="4.5" />
          <line x1="10" y1="12" x2="10" y2="7" />
          <line x1="13" y1="12" x2="13" y2="4.5" />
        </>
      );
    // VII — партнёрство. Two grounds with a shared middle.
    case 7:
      return (
        <>
          <circle cx="5.8" cy="8" r="4.2" />
          <circle cx="10.2" cy="8" r="4.2" />
        </>
      );
    // VIII — трансформация, общие ресурсы. One shape, half of it turned over.
    case 8:
      return (
        <>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M2.5 8 A5.5 5.5 0 0 0 13.5 8 Z" fill="currentColor" stroke="none" />
        </>
      );
    // IX — философия, путешествия, учёба. A horizon, and a point past it.
    case 9:
      return (
        <>
          <path d="M2 12.2 Q8 3.6 14 12.2" />
          <circle cx="8" cy="2.9" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
    // X — карьера, статус, публичное. A rise taken in steps.
    case 10:
      return <path d="M2.5 13 L2.5 10 L7 10 L7 6.5 L11.5 6.5 L11.5 3 L14 3" />;
    // XI — цели, друзья, сообщество. Peers, linked, with no centre.
    case 11:
      return (
        <>
          <path d="M8 3.6 L13 12 L3 12 Z" />
          <circle cx="8" cy="3.6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="13" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
    // XII — тень, подсознание, уединение. A ground you can only half see.
    case 12:
      return (
        <>
          <circle cx="8" cy="8" r="5.5" />
          <line x1="4" y1="9.6" x2="12" y2="9.6" strokeDasharray="2 1.8" />
          <line x1="5.4" y1="12.2" x2="10.6" y2="12.2" strokeDasharray="2 1.8" />
        </>
      );
    default:
      return <circle cx="8" cy="8" r="5.5" strokeDasharray="2 2" />;
  }
}

export function HouseGlyph({ house, size = 14, className = "", title }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      style={{ flexShrink: 0, display: "block" }}
    >
      {title && <title>{title}</title>}
      {paths(house)}
    </svg>
  );
}

// One word per house, matching the lunation lane in TimelinePanel — the label
// under a glyph and the label under a new moon should say the same thing.
export const HOUSE_SHORT: Record<number, string> = {
  1: "я, тело",
  2: "деньги",
  3: "связи",
  4: "дом",
  5: "творчество",
  6: "рутина",
  7: "партнёры",
  8: "близость",
  9: "философия",
  10: "карьера",
  11: "цели",
  12: "тень",
};
