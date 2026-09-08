# Year at a Glance

![The dial at night: nine planets on their orbits](docs/preview.png)

An art piece about proportion. The solar system as a dial: where the planets
stand on a given day, the simple angles between them, and how their years
divide into one another.

**Live:** https://year-at-a-glance-beta.vercel.app

## How to read it

- The Sun in the centre, the planets on their rings, each with a tail for the
  arc it has just travelled. Rings are spaced for reading, not to scale; the
  angles are exact.
- Click the Sun to draw the angles between planets that come close to a simple
  fraction of a turn: a half, a third, a quarter, a sixth. The closer, the
  heavier the line.
- The table lists pairs of planets whose years stand in a small whole-number
  ratio, with the measured value beside the ideal.
- Scroll or drag to move through time. `R` or `T` returns to today.

## Built with

Next.js, TypeScript, SVG. Positions from
[astronomy-engine](https://github.com/cosinekitty/astronomy), computed
locally. Orbital periods are fitted from the same ephemeris; see
`src/lib/periods.ts`.

```bash
npm install
npm run dev
```
