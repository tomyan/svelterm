# Browser compatibility

The rule: **any HTML/CSS feature with a sensible meaning on a grid of
character cells works the way a browser author expects.** Features with
no grid meaning parse and are silently dropped — never a crash, never a
half-render. The test of "sensible" is whether the feature survives the
move from pixels to cells: structure, cascade, selectors, layout, colour,
and state all do; sub-cell geometry does not.

## The three buckets

1. **Implemented faithfully** — spec behaviour on the cell grid. This is
   most of what pasted browser CSS touches; the other chapters document
   it and the [reference](./reference.md) tabulates it.
2. **Approximated, documented** — the concept maps but the grid forces a
   compromise. Each approximation is deliberate and tested:
   - 1 cell is the atom: every length rounds to whole cells.
   - `opacity < 1` ≈ the terminal *dim* attribute (binary).
   - `vertical-align: baseline` ≈ `top` in tables.
   - `<select>` is a popup-less cycling control — a dropdown has no good
     cell-grid answer.
   - Animation is linear (no easing) and lengths step by whole cells.
3. **Out of scope** — dropped silently, styled per mode instead.

## The ignored list

Pixel-derived lengths (`px`, `em`, `rem`, `ex`, `vw`, `vh`) ·
typography (`font-size`, `font-family`, `line-height`,
`letter-spacing`, `word-spacing`) · sub-cell decoration
(`border-radius`, `box-shadow`, `outline`, `filter`,
`backdrop-filter`) · geometry (`transform`, `rotate`, `scale`,
`translate`, `perspective`) · `background-image` and gradients ·
`float` · `@font-face`, `@page` · easing keywords.

## The pattern

Style each mode on its own terms with
[`display-mode`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode)
blocks — svelterm matches `terminal`, real browsers apply the `browser`
block as ordinary CSS:

```css
.card {
    padding: 1ch;                      /* shared — 1ch is 1 cell */
    @media (display-mode: browser) {
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 2px 8px #0002;
    }
    @media (display-mode: terminal) {
        border: rounded;
    }
}
```

Because the ignored list drops rather than errors, a component pasted
from a website renders sensibly with **zero terminal-specific CSS** —
the shadows and radii simply don't appear until you add terminal styling.

## Where this is pinned down

- [`reference.md`](./reference.md) — the one-page support matrix.
- `DESIGN-browser-compat.md` in the repo root — the design rationale and
  slice history.
- The acceptance tests (`test/browser-compat-acceptance.test.ts`) keep
  both promises honest: a website-flavoured card renders with no
  terminal CSS, and every ignored declaration parses without effect.
