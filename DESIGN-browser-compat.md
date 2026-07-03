# Design — Browser HTML/CSS compatibility

## Goal

Any HTML/CSS feature that can work *sensibly* on a cell grid should work, and
work the way a browser author expects. Features that cannot work sensibly are
**never emulated** — they are explicitly out of scope, silently ignored by the
terminal renderer, and authors target them per mode with
`@media (display-mode: browser | terminal)`.

The test of "sensible": does the feature have a natural meaning in a grid of
character cells? Structure, cascade, selectors, layout, color, and state all
do. Sub-cell geometry (pixels, fractional borders, shadows, transforms) does
not.

## The three buckets

Every CSS/HTML feature lands in exactly one bucket:

1. **Implement faithfully** — spec behaviour on a cell grid.
2. **Approximate with documented deviation** — the concept maps but the grid
   forces a compromise. Each deviation is written down where it's implemented
   and covered by a test asserting the approximation.
3. **Out of scope** — no grid meaning. The declaration parses and is dropped
   (never a crash, never a half-render). The documented author pattern is a
   `display-mode` media query.

### Bucket 3 — out of scope (the "media-query it" list)

- **Pixel-derived lengths**: `px`, `em`, `rem`, `ex`, `vw/vh` (viewport units
  in *pixels*; `%` of the cell viewport is bucket 1 and works today). These
  parse to 0/dropped today — keep it that way.
- **Typography**: `font-size`, `font-family`, `line-height`,
  `letter-spacing`, `word-spacing`. One cell, one glyph.
- **Sub-cell decoration**: `border-radius` (authors use terminal-native
  `border: rounded`), `box-shadow`, `outline`, `filter`, `backdrop-filter`.
- **Geometry**: `transform`, `rotate`/`scale`/`translate`, `perspective`.
- **Images as CSS**: `background-image`, gradients. (Inline `<img>` via
  sixel/kitty is a separate PLAN.md item, not CSS compat.)
- **Floats**: legacy layout; flex/grid cover the use cases. `float` parses
  and is ignored.
- `@font-face`, `@page`, print properties.

### Bucket 2 — approximations (current + accepted)

- `vertical-align: baseline` ≈ `top` (tables; documented in
  DESIGN-tables.md).
- `opacity: <number>` < 1 ≈ `dim`.
- Anonymous table cells don't coalesce consecutive inline content (one cell
  per stray node; documented in the slice-6 commit).
- 1 cell is the atom: any length rounds to whole cells.

## Gap inventory (bucket 1, not yet implemented)

Grounded against the code as of 2026-07-03:

| Area | Gap |
|---|---|
| Selectors | attribute matchers `[a^=v]`, `[a$=v]`, `[a*=v]`, `[a~=v]`, `[a\|=v]`; `:empty`, `:first-of-type`, `:last-of-type`, `:only-child`, `:only-of-type`; `:checked`, `:disabled`, `:enabled` |
| Pseudo-elements | `::before` / `::after` with `content` (strings, `attr()`, `counter` out of scope initially) |
| Grid | `grid-row` (+ `grid-area` numeric), `minmax()`, `grid-template-areas` + named `grid-area`, `grid-auto-flow: column` |
| Units | `ch` ≡ `cell` (a cell is a character width) |
| Transitions | `transition` shorthand + `transition-property/duration` for color + integer lengths |
| Form elements | checkbox/radio `<input type=…>`, `<select>` (as popup-less cycling control), `<progress>`, `<meter>` |
| Interactive HTML | `<details>`/`<summary>` toggle |
| Inline layout | inline `vertical-align` on inline-block runs (bucket 2 candidate — investigate before promising) |

Everything else commonly hit by pasted browser CSS is already in: cascade +
specificity, `var()`, `calc()`/`min()`/`max()`/`clamp()`, `light-dark()`,
color level 4, `@media`/`@container`/`@supports`, flexbox, grid columns,
tables (full), `:where()/:is()/:not()/:nth-*`, `inherit/initial/unset`,
`currentColor`, margin collapse, `position`, `z-index`, `overflow`.

## Slices (elephant carpaccio — each lands green, committed, demo-checked)

1. **Attribute selector matchers** — `^= $= *= ~= |=` in `parseAttrSelector`
   + matching. Pure selector work, unlocks icon-per-link-type styling.
2. **Structural pseudo-classes** — `:empty`, `:first-of-type`,
   `:last-of-type`, `:only-child`, `:only-of-type` (reuse the nth machinery).
3. **State pseudo-classes** — `:checked`, `:disabled`, `:enabled` driven by
   element attributes; wire `disabled` into focus traversal (skip) and
   input/button behaviour.
4. **`ch` unit** — alias of `cell` in the value parsers.
5. **`::before`/`::after` + `content`** — biggest lever. Parser: selector
   suffix; compute: per-element pseudo styles; layout/paint: virtual firstesq/
   last child text runs. `content: "str"` and `attr(x)`; `content: none/""`.
6. **Grid rows** — `grid-row` start/span, explicit row track heights already
   parse via `grid-template-rows`; add `minmax()`.
7. **`grid-template-areas`** + named `grid-area` placement.
8. **`<progress>`/`<meter>`** — UA-styled bar rendered with block glyphs;
   value/max attributes; stylable via `color`/`background`.
9. **Checkbox/radio** — `[x]`/`( )` glyph inputs, `:checked` styling, space
   toggles, radio groups by `name`.
10. **`<details>`/`<summary>`** — open/close on Enter/click, `[open]`
    attribute selector styling.
11. **Transitions** — `transition: color 200ms`, lerp colors/integers on
    style change, reusing the animation clock.
12. **`<select>`** — last; interaction design needed (popup vs cycle).

Each slice: red (failing tests incl. 1–2 WPT-derived cases where they exist),
green, refactor, update the relevant demo only when it adds demonstration
value, commit, push.

## Acceptance for the feature as a whole

1. A representative "pasted from a website" card (heading, links with
   attribute-styled icons, list, form controls, badge via `::after`) renders
   sensibly in the terminal with **zero terminal-specific CSS**, and pixel
   styling degrades silently.
2. Every bucket-3 feature has a test asserting it parses-and-drops without
   error.
3. README gains a compatibility table pointing at this doc.
4. PLAN.md's stale "CSS completeness" section replaced by a pointer here.

## Out of scope for this design

- Inline rendering mode (DESIGN-inline-mode.md), images, syntax highlighting,
  virtual scrolling — orthogonal PLAN.md items.
- Full WPT conformance — port targeted cases per slice, as with tables.
