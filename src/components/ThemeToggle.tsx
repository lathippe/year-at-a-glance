"use client";

import { useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  // Read once, lazily: the layout's inline script has already stamped
  // data-theme before hydration, so there is nothing to synchronise afterwards.
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === "undefined" ? "light" : currentTheme()
  );

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    // Synchronous, inside the click. The palette flips the instant the attribute
    // is set, but anything listening through MutationObserver only hears about it
    // after the browser has already painted — so for a frame or two the page was
    // in the new palette while the chart was still drawn for the old one. That
    // mismatched frame is the flash: a white square on a dark page, a dark disc
    // on a light one. Dispatching here puts the chart's update in the same React
    // commit as the toggle, so there is nothing to catch.
    window.dispatchEvent(new Event("themechange"));
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  // The label says nothing about which theme is on, and that is deliberate. It
  // used to name the other one, which meant the server rendered "night theme"
  // and the browser, already stamped with the reader's choice, rendered "day" —
  // a hydration mismatch on every load in the wrong theme. A verb has no such
  // problem, and the button's job is the same either way.
  return (
    <button
      onClick={toggle}
      aria-label="Switch between the day and night charts"
      title={theme === "dark" ? "Switch to the day chart" : "Switch to the night chart"}
      className="flex items-center gap-2 rounded-full border border-[color:var(--border)] hover:border-[color:var(--border-strong)] transition-colors text-[color:var(--muted-strong)] px-3 h-8 cursor-pointer"
    >
      <span style={{ fontSize: 14 }} aria-hidden>
        ☾
      </span>
      <span className="label">theme</span>
    </button>
  );
}
