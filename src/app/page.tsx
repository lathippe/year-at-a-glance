import { SelectedDateProvider } from "@/lib/selectedDate";
import { ThemeToggle } from "@/components/ThemeToggle";
import { YearAtAGlance } from "@/components/YearAtAGlance";
import { skyRibbon } from "@/lib/skyRibbon";

export const dynamic = "force-dynamic";

/**
 * The public page. One universal chart of the real sky: no birth data, no
 * person, nothing that is true for one reader and not another. Scanned on the
 * server because the ribbon walks the whole window through the ephemeris.
 */
export default function Home() {
  // Centre and span cover 1 Jan 2026 to 30 Apr 2027, the window the page draws.
  const centre = new Date(Date.UTC(2026, 8, 1));
  const bars = skyRibbon(centre, 245);

  return (
    <SelectedDateProvider>
    <main className="min-h-screen w-full max-w-[1180px] mx-auto px-4 py-10 sm:py-14">
      <div className="flex justify-end mb-2">
        <ThemeToggle />
      </div>
      <YearAtAGlance bars={bars} />
      <footer className="mt-16 flex flex-col items-center gap-1 text-center">
        <span className="label">Heliocentric dial · geocentric aspects</span>
        <span className="text-[11px] text-[color:var(--muted)]">
          Ephemerides computed locally with astronomy-engine. No accounts, no
          tracking, no birth data.
        </span>
      </footer>
    </main>
    </SelectedDateProvider>
  );
}
