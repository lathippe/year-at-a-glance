"use client";

import { useEffect, useState } from "react";

function readIsDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light") return false;
  if (attr === "dark") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Whether the dashboard is currently dark. Starts light so the server and the
 * first client render agree, then corrects on mount — the inline script in the
 * layout has already stamped data-theme by then. Watches both the attribute
 * (manual toggle) and the OS setting (no attribute set).
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => setIsDark(readIsDark());
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    // The observer is the fallback for changes made from outside a click; the
    // event is what makes the in-app toggle land in the same paint.
    window.addEventListener("themechange", sync);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", sync);
      window.removeEventListener("themechange", sync);
    };
  }, []);

  return isDark;
}
