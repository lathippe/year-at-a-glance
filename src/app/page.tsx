import { SelectedDateProvider } from "@/lib/selectedDate";
import { StarField } from "@/components/StarField";
import { ThemeToggle } from "@/components/ThemeToggle";
import { YearAtAGlance } from "@/components/YearAtAGlance";
import { simpleRatios } from "@/lib/periods";

export const dynamic = "force-dynamic";

/**
 * One screen and nothing under it. The real sky, the same for everybody: no
 * input, nothing true for one reader and not another.
 *
 * The period ratios are fitted here, on the server, once per process. They
 * never change, and the fit is a few thousand ephemeris calls the browser has
 * no reason to repeat.
 */
export default function Home() {
  const ratios = simpleRatios();
  return (
    <SelectedDateProvider>
      <StarField />
      <main className="relative h-[100dvh] w-full overflow-hidden">
        {/* Floating: anything in the flow pushes the dial off the bottom. */}
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <YearAtAGlance ratios={ratios} />
      </main>
    </SelectedDateProvider>
  );
}
