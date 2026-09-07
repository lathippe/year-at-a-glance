import type { Metadata } from "next";
import { Inter, Roboto_Mono, Literata } from "next/font/google";
import "./globals.css";

// The page is English now, but the engine still names bodies in Russian and a
// stray name reaching the screen should at least render: every family keeps
// the Cyrillic subset. Midday's own sans is Hedvig Letters Sans, which has no
// Cyrillic. refero's substitute is Inter with the letter-spacing overridden —
// the widened tracking is the theme's signature, not the typeface.
const sans = Inter({
  variable: "--font-sans-family",
  subsets: ["latin", "cyrillic"],
});

// Was IBM Plex Mono, whose zero is slashed. Roboto Mono draws a plain oval
// zero, ships Cyrillic, and is variable, so the 400/500/600 the labels use come
// from one file instead of three.
const mono = Roboto_Mono({
  variable: "--font-mono-family",
  subsets: ["latin", "cyrillic"],
});

// Was Fraunces, which has no Cyrillic in any subset — the display serif never
// actually rendered a Russian date. Literata covers Cyrillic and keeps the opsz
// axis, so the optical-size behaviour Fraunces was picked for survives.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "cyrillic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Year at a Glance: simple ratios between the planets",
  description:
    "The planets where they really are, January 2026 to spring 2027, on one dial. Halves, thirds and quarters of a circle between them, and whole-number ratios between their orbital periods, in a configuration nobody arranged.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      // The inline script below stamps data-theme before React arrives, so the
      // root element is meant to differ from what the server sent.
      suppressHydrationWarning
      lang="en"
      className={`${sans.variable} ${mono.variable} ${literata.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',(t==='light'||t==='dark')?t:'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
