"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type SelectedDate = {
  /** Local midnight of the day the whole dashboard is looking at. */
  selected: Date;
  setSelected: (d: Date) => void;
  today: Date;
  isToday: boolean;
  /** Whole days from today; negative for the past. */
  offset: number;
};

const Ctx = createContext<SelectedDate | null>(null);

/**
 * One day in focus, shared by every panel. The cycle calendar, the petal ring,
 * the orrery and the timeline cursor all read and write this, so picking a date
 * anywhere moves all of them.
 */
export function SelectedDateProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selected, setSelectedRaw] = useState<Date>(today);
  const setSelected = useCallback((d: Date) => setSelectedRaw(startOfDay(d)), []);

  const value = useMemo<SelectedDate>(
    () => ({
      selected,
      setSelected,
      today,
      isToday: selected.getTime() === today.getTime(),
      offset: Math.round((selected.getTime() - today.getTime()) / 86400000),
    }),
    [selected, setSelected, today]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelectedDate(): SelectedDate {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSelectedDate must be used inside SelectedDateProvider");
  return v;
}
