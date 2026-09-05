import { SelectedDateProvider } from "@/lib/selectedDate";
import { StarField } from "@/components/StarField";
import { ThemeToggle } from "@/components/ThemeToggle";
import { YearAtAGlance } from "@/components/YearAtAGlance";

export const dynamic = "force-dynamic";

/**
 * One screen and nothing under it. A universal chart of the real sky: no birth
 * data, no person, nothing true for one reader and not another.
 */
export default function Home() {
  return (
    <SelectedDateProvider>
      <StarField />
      <main className="relative h-[100dvh] w-full overflow-hidden">
        {/* Floating: anything in the flow pushes the dial off the bottom. */}
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <YearAtAGlance />
      </main>
    </SelectedDateProvider>
  );
}
