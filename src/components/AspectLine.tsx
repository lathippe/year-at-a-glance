import { aspectTone, ASPECT_TONE_COLOR } from "@/lib/astrology";

type AspectLike = { name: string; nameRu: string; symbol: string };

/**
 * "☿ Меркурий △ ♀ Венера нат." — one line, no serifs. The aspect word is carried
 * by its symbol, coloured by what it means: turquoise harmonious, red tense,
 * violet fusing. The word itself stays in `title`, so the glyph is never the
 * only key to it.
 */
export function AspectLine({
  transitGlyph,
  transitRu,
  natalGlyph,
  natalRu,
  aspect,
  className = "",
}: {
  transitGlyph: string;
  transitRu: string;
  natalGlyph: string;
  natalRu: string;
  aspect: AspectLike;
  className?: string;
}) {
  return (
    <span className={`text-sm font-medium ${className}`}>
      <span className="text-[color:var(--foreground)]">
        {transitGlyph} {transitRu}
      </span>
      <span
        className="mx-1.5"
        style={{ color: ASPECT_TONE_COLOR[aspectTone(aspect.name)] }}
        title={aspect.nameRu}
      >
        {aspect.symbol}
      </span>
      <span className="text-[color:var(--muted-strong)]">
        {natalGlyph} {natalRu}
      </span>
      <span className="text-[color:var(--muted)] ml-1">нат.</span>
    </span>
  );
}
