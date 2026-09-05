# Year at a Glance

A year of sky on one dial. January 2026 to the spring of 2027: the planets keep
their real angles, the aspects between them come and go, and the whole stretch
plays through once when the page opens.

**Live:** _(deploy link)_

## What it draws

- **A heliocentric orrery.** The Sun at the centre, the planets on rings, each
  with a tail showing the arc it has just travelled. Distances run from 0.4 to
  30 AU, so the rings are spaced for reading rather than to scale — every angle
  on the dial is exact, no radius is.
- **Aspects as arcs.** Two planets at a significant angle are joined by one thin
  arc, bowed outward so three of them can never close into a triangle. Each arc
  thins in the middle, and how far it thins is the hardness of the aspect: a
  trine barely dips, a square nearly parts, an opposition comes apart entirely.
- **The same year on one line.** Every slow aspect as the window it is open for,
  with a dot on the day its orb is tightest.

## What it does not do

No accounts, no tracking, no birth data. The chart is the real sky and is the
same for everybody, which is the only thing a public page can honestly show.

## Built with

Next.js, TypeScript, SVG. Ephemerides computed locally with
[astronomy-engine](https://github.com/cosinekitty/astronomy) — no external
service and no API keys.

```bash
npm install
npm run dev
```
