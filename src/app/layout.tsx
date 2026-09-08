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

const SITE = "https://year-at-a-glance-beta.vercel.app";
const TITLE = "Year at a Glance: simple ratios between the planets";
const DESCRIPTION =
  "An art piece about proportion. The solar system as a dial: where the planets stand, the simple fractions of a circle between them, and how their years divide into one another.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  // The picture a shared link carries. A screenshot of the dial with the
  // relations on, night sky, 1200×630.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE,
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "The dial: nine planets on their orbits with the simple angles between them drawn in" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
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
