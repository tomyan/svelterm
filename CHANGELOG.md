# Changelog

## 0.3.0 — 2026-07-04

Motion completeness: easing everywhere, and keyframes that understand
your theme.

### Added

- **Easing functions** — `animation-timing-function` and
  `transition-timing-function` (longhands and inside the shorthands)
  support `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`,
  `cubic-bezier()`, `steps(n[, start|end])`, `step-start` and `step-end`.
  Easing applies per keyframe segment; non-interpolable values switch when
  eased progress crosses the midpoint, as in CSS.
- **Keyframe `var()` / `light-dark()`** — keyframe declarations resolve
  custom properties and colour-scheme pairs against the animated element
  when the animation starts.

### Changed

- Timing functions default to `ease` per spec (previously everything
  interpolated linearly). Declare `linear` explicitly to keep the old
  behaviour.

## 0.2.0 — 2026-07-04

The browser-compatibility release: any HTML/CSS feature with a sensible
cell-grid meaning now works as a browser author expects. Full support matrix
in [`docs/reference.md`](docs/reference.md); manual in [`docs/`](docs/).

**Requires** a Svelte fork with the custom renderer API. Until
[sveltejs/svelte#18505](https://github.com/sveltejs/svelte/pull/18505) lands,
use [`tomyan/svelte#svelte-custom-renderer`](https://github.com/tomyan/svelte/tree/svelte-custom-renderer)
(upstream plus the `svelte/renderer` mount export svelterm needs on Node).

### Added

- **CSS grid** — column and row templates with `fr`/`repeat()`/`minmax()`,
  `grid-column`/`grid-row` placement and spans, `grid-template-areas` with
  named `grid-area`
- **CSS tables** — `display: table*` including `inline-table`, sections and
  captions, `colspan`/`rowspan`, `vertical-align`, `border-collapse` with
  shared box-drawing grid lines, anonymous table boxes
- **Animations & transitions** — `@keyframes` wired into the render loop
  with RGB colour interpolation between stops, cell-stepped length
  animation, discrete stepping for other properties; `transition` on style
  changes
- **Selectors** — attribute operators (`^=`, `$=`, `*=`, `~=`, `|=`),
  `:is()`/`:where()`, the `:nth-child()` family, structural pseudo-classes
  (`:empty`, `:first/last/only-of-type`, `:only-child`),
  `:checked`/`:disabled`/`:enabled`, `::before`/`::after` with `content`
- **Form controls** — checkboxes and radios, cycling `<select>`,
  `<progress>`/`<meter>` block-glyph bars, `<details>`/`<summary>`,
  labels activate their controls on click
- **CSS values** — Color Level 4 syntax, `light-dark()`, inline `style`
  attributes, `box-sizing`, `text-transform`, the `ch` unit as a `cell`
  alias
- **Scrolling** — viewport scrolling with overlay scrollbars, horizontal
  scroll, scroll clamping on resize
- **Borders** — block-character border styles with half-cell corner
  treatment
- **IO abstraction** — `ProcessIO` (with `/dev/tty` fallback when stdin is
  piped) and `InProcessIO` for embedding; browser-compatible input parsing
- **Dev mode** — `svelterm dev` CLI with Vite environments, HMR, and a
  two-process WebSocket bridge
- **Docs** — chaptered manual under `docs/` and a full feature support
  matrix with MDN links in `docs/reference.md`

### Changed

- Tracks the upstream unified `mount({ renderer, target, props })` API from
  the `svelte-custom-renderer` branch
- Exact hex/computed colours are no longer remapped to nearest ANSI names
- Flex `align-items: stretch` no longer overrides an explicit cross-axis
  size

### Fixed

- Incremental repaint artifacts (borders, list markers), flex `min-height:
  auto` shrinking per spec, nested `@media` inside selector blocks, inline
  whitespace and list bullets, scroll position clamping after relayout

## 0.1.0

Initial release — name reservation and early preview.

**Requires** the unmerged [`svelte-custom-renderer`](https://github.com/paoloricciuti/svelte/tree/svelte-custom-renderer) branch of Svelte 5.

### Features

- **CSS engine** — selectors, specificity, cascade, inheritance, scoped styles, `var()`, `calc()`, `@media`, `@keyframes`, `:focus`, `:hover`
- **Flexbox layout** — `flex-direction`, `justify-content`, `align-items`, `flex-grow`, `flex-shrink`, `flex-basis`, `gap`, `flex-wrap`, `order`
- **Terminal rendering** — ANSI colors (16, 256, truecolor), box-drawing borders (`single`, `double`, `rounded`, `heavy`), text styles, differential output
- **Incremental updates** — mutations classified as paint-only, style-resolve, layout-subtree, or layout-bubble to avoid full recomputation
- **Input handling** — keyboard events, mouse (click, scroll, motion), focus management with Tab/Shift+Tab, bracketed paste
- **Text input** — `<input>` and `<textarea>` with readline-like editing
- **Color scheme detection** — automatic `prefers-color-scheme` via OSC 11 terminal query
- **Debug protocol** — WebSocket-based CDP-inspired server with Console domain
- **Dual-target components** — same `.svelte` component renders in terminal and browser via `@media (display-mode: terminal/screen)`
