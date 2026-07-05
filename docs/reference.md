# svelterm feature reference

svelterm renders Svelte components to a terminal cell grid with HTML/CSS
semantics. This is the authoritative list of what is supported, what is
approximated, and what is deliberately ignored. Standard features link to
MDN rather than re-explaining them; terminal-specific behaviour is
documented in full here.

**The rule:** any feature with a sensible meaning on a grid of character
cells works the way a browser author expects. Features with no cell-grid
meaning (pixels, fonts, sub-cell geometry) parse and are silently dropped —
never a crash. Target modes separately with
`@media (display-mode: terminal)` / `@media (display-mode: browser)`.

---

## Terminal-specific extensions

These do not exist in browsers and are svelterm's own surface.

### The `cell` unit

One terminal cell — the atomic unit of layout. `width: 20cell`,
`padding: 1cell 2cell`. [`ch`](https://developer.mozilla.org/en-US/docs/Web/CSS/length#ch)
is accepted as an exact alias (1ch = 1cell), which lets stylesheets work in
both modes. All lengths round to whole cells. Unitless `0` is valid.

### `@media (display-mode: terminal | browser)`

Reuses the standard [`display-mode`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/display-mode)
media feature with two custom values. The terminal renderer evaluates
`terminal` as true; real browsers never match either custom value, but a
`browser` block simply applies as normal CSS there. This is the documented
pattern for anything in the ignored bucket:

```css
.card {
    @media (display-mode: browser)  { box-shadow: 0 2px 8px #0004; }
    @media (display-mode: terminal) { border: single; }
}
```

### Border styles

[`border-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/border-style)
takes terminal-native values drawn with box-drawing and block glyphs
(browser values like `solid`/`dashed` are ignored — use a `display-mode`
block):

| Value | Look |
|---|---|
| `single` | `┌─┐` light box drawing |
| `double` | `╔═╗` double lines |
| `rounded` | `╭─╮` rounded corners |
| `heavy` | `┏━┓` heavy lines |
| `ascii` | `+-+` plain ASCII |
| `eighth-cell-inner` / `eighth-cell-outer` | thin eighth-block edges inside/outside the cell |
| `half-cell-inner` / `half-cell-outer` | half-block edges |
| `full-cell` | full-block frame |

Borders are 1 cell thick. `border-top/right/bottom/left: true|false`
enable individual sides. `border-corner: h | v | none` picks corner
character bias. `border-color` works as standard (including
`currentColor`).

### Colour on a terminal

Resolved colours are either ANSI palette names (`red`, `cyan`, …) or
24-bit truecolor. CSS keywords that match the 8 basic ANSI names map to
palette entries (themeable by the user's terminal); explicit hex/`rgb()`
etc. stay exact. `transparent` means "no colour set" — the parent's
background shows through. The terminal's own dark/light scheme is detected
via OSC 11 polling (overridable through `run({ colorScheme })`) and drives
[`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)
and `@media (prefers-color-scheme: …)`.

### `opacity` ≈ `dim`

There is no alpha channel. `opacity` below 1 applies the terminal's dim
attribute; the non-standard value `opacity: dim` does the same explicitly.

### `<svt-region>`

A paint primitive that fills its layout box from a consumer-provided
cell source (used to embed full terminal emulators). It fires a `resize`
event with `{ cols, rows }` when its allocated size changes. Without an
explicit size it fills the parent box like a replaced element.

### Focus and keys

`Tab`/`Shift+Tab` cycle focusable elements (`button`, `input`, `textarea`,
`a`, `select`, `summary`); disabled controls are skipped. The focused
element matches `:focus`. `Enter` clicks the focused element (opens `href`
on links, toggles `<details>`, cycles `<select>`); `Space` toggles
checkboxes/radios and cycles selects. Mouse clicks focus, click, and
activate the same defaults. Clicking a
[`<label>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/label)
activates its control — wrapping or `for="id"` association both work.
`Ctrl+C` exits.

### Interaction model for form controls

- **Checkbox** renders `[x]` / `[ ]`; **radio** renders `(•)` / `( )`
  (3×1 cells). Radios group by `name` across the tree.
- **`<select>`** is a popup-less cycling control: it renders the selected
  option's label plus `▾`, sized to the longest option. `ArrowUp`/
  `ArrowDown` move the selection (wrapping); `Space`/`Enter`/click advance.
  There is no dropdown popup — it has no good cell-grid answer.
- **`<progress>`/`<meter>`** render as 20×1 block-glyph bars (`█` fill
  with eighth-block partials, `░` track), stylable via `color`/
  `background`, sized via `width`/`height`.

### Events

W3C-style capture/bubble dispatch on the component tree: `click`,
`keydown`, `input`, `change`, `paste`, `toggle` (details), `resize`
(svt-region), plus mouse events with cell coordinates. Event payloads ride
on `event.data` (e.g. `{ value, cursor }`, `{ checked }`).

---

## HTML elements

Standard semantics unless noted. Anything unlisted renders as a plain
block/inline box per its display default.

| Element | Notes | Reference |
|---|---|---|
| headings, `p`, `div`, `span`, lists, `blockquote`, `pre`, `code`, `hr` | UA-styled like a browser (margins in cells, `hr` as `─` rule, list markers) | [HTML elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Element) |
| `strong`/`b`, `em`/`i`, `u`, `s`/`del`, `mark`, `kbd`, `abbr`, `samp`, `var` | text attributes (bold/italic/underline/strikethrough/colour) | — |
| `a` | underlined, focusable; Enter/click opens `href` in the local browser | [`<a>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a) |
| `table` and friends | full table layout: colspan/rowspan, header/footer groups, caption, `colgroup`/`col` width hints, collapse/separate borders, `empty-cells` | [`<table>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/table) |
| `input` (text) | single-line editor with cursor, `value`, `input` events; `maxlength`, `readonly` | [`<input>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) |
| `input type="password"` | value masked as `•` bullets; editing as text | [password](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/password) |
| `input type="checkbox" / "radio"` | glyph toggles; `checked` attribute/property; `change`+`input` events | [checkbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox), [radio](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio) |
| `textarea` | multi-line editing | [`<textarea>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea) |
| `button` | focusable, centred text, `click` on Enter/click | [`<button>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button) |
| `select`/`option`/`optgroup` | cycling control (see above); `change`+`input` with the option value | [`<select>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select) |
| `progress`, `meter` | block-glyph bars; `value`/`max` (+`min` for meter); no-value progress renders track only | [`<progress>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/progress), [`<meter>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meter) |
| `details`/`summary` | ▶/▼ disclosure, `open` attribute, `toggle` event, focusable summary | [`<details>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details) |
| `img` | half-block pixels (▀) from PNG file paths / `data:image/png` URIs; real pixels via the kitty graphics protocol where supported; sized by CSS `width`/`height` | [`<img>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img) |
| `video`, `canvas`, `iframe` | not rendered | — |

## CSS selectors

All standard matching semantics. Reference: [MDN selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors).

- Type, `.class`, `#id`, `*`, selector lists (`a, b`)
- Combinators: descendant, `>`, `+`, `~`
- Attributes: `[a]`, `[a=v]`, `[a^=v]`, `[a$=v]`, `[a*=v]`, `[a~=v]`, `[a|=v]` (quoted or unquoted values)
- Pseudo-classes: `:root`, `:focus`, `:hover` (mouse), `:first-child`,
  `:last-child`, `:only-child`, `:empty`, `:first-of-type`,
  `:last-of-type`, `:only-of-type`, `:nth-child()`, `:nth-last-child()`,
  `:nth-of-type()`, `:nth-last-of-type()` (full An+B), `:not()`, `:is()`,
  `:where()`, `:checked`, `:disabled`, `:enabled`
- Pseudo-elements: `::before`, `::after` (single-colon legacy accepted)
  with `content:` strings, `attr(x)`, `counter(name)` (with
  `counter-reset` / `counter-increment`, including explicit amounts),
  space-separated concatenation, and `none`/`""`. Counters use a flat
  namespace — no per-scope nesting or `counters()` joining — and update
  on full style resolution, so an incremental restyle can serve stale
  numbers until the next full pass. Pseudo boxes are inline and invisible
  to `:empty`/`:nth-*`. In table-internal boxes they render per §17.2.1:
  a pseudo on a row or table box becomes an anonymous cell/row.
- Specificity, source order, and inline-`style` precedence follow the
  [cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade).

## CSS properties

Grouped; all standard behaviour (per MDN) except the noted grid
adaptations. Lengths are cells (`cell`/`ch`, `%`, or `calc()`).

| Group | Properties |
|---|---|
| [Colour & text](https://developer.mozilla.org/en-US/docs/Web/CSS/color) | `color`, `background`/`background-color`, `font-weight` (≥700 = bold), `font-style` (italic), `text-decoration` (underline/line-through), `text-transform`, `text-align`, `text-overflow` (`ellipsis`, plus non-standard `ellipsis-middle`), `white-space` (`normal`/`nowrap`/`pre`), `opacity` (≈dim), `visibility` |
| [Box model](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model) | `width`, `height`, `min/max-width`, `min/max-height`, `padding(-*)`, `margin(-*)` (incl. `auto` centring and margin collapse), `box-sizing`, `overflow` (`hidden`/`scroll`/`auto` with real scrolling + fading scrollbars) |
| [Display & flow](https://developer.mozilla.org/en-US/docs/Web/CSS/display) | `display: block, inline, inline-block, flex, grid, none, contents`, all table display types |
| [Flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout) | `flex-direction` (all four), `flex-wrap`, `flex`/`flex-grow`/`flex-shrink`/`flex-basis`, `gap`, `justify-content` (incl. `space-*`), `align-items`, `align-self`, `order` |
| [Grid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout) | `grid-template-columns/rows` (`cell`/`ch`/`%`/`fr`, `repeat()`, `minmax()`), `grid-template-areas` + `grid-area` (named and numeric), `grid-column`, `grid-row` (start / start‑end / `span n`), `gap`, `grid-auto-flow: row \| column` (column flow wraps at the explicit row count; implicit columns take the last explicit column's width). Fractional `minmax()` minimums redistribute: a track clamped to its minimum leaves the pool and the freed space re-splits among the rest |
| [Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/position) | `position: static/relative/absolute/fixed/sticky` with `top/right/bottom/left`, `z-index`. Relative offsets shift visually without moving flow; sticky is top-edge only inside scroll containers (no push-out at the containing block end) |
| [Tables](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_table) | `border-collapse`, `border-spacing`, `caption-side`, `table-layout`, `empty-cells`, `vertical-align` (`baseline` ≈ `top`) |
| Borders | `border`/`border-style`/`border-color`/`border-corner` + per-side toggles (terminal values above). `border-collapse: collapse` on a container (inherited — `:root` works) makes adjacent bordered siblings in block flow, flex, and grid share a single border line with junction glyphs (`├` `┬` `┼`) — a cell-grid extension of the table property |
| [Animation](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations) | `animation` shorthand, `animation-name/-duration/-iteration-count` (incl. `infinite`)/`-timing-function`, `@keyframes` (from/to/percentages, values resolve `var()`/`light-dark()`) |
| [Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions) | `transition` shorthand with per-property comma groups; `transition-property`/`-duration`/`-timing-function` longhand lists paired per spec; interruptions continue from the current value |
| [Easing](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function) | `linear`, `ease` (default), `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier()`, `steps()`, `step-start`, `step-end` |

### Animation & transition semantics on the grid

Colours interpolate in RGB at ~30fps; single cell/ch lengths interpolate
to whole cells (movement steps cell by cell); every other supported
property applies discretely, switching at the segment midpoint (the CSS
rule for non-interpolable values). Layout-affecting animations re-flow
each frame. Easing applies per keyframe segment (a timing function
declared inside a keyframe overrides the element's for that segment);
non-interpolable values switch when eased progress crosses the midpoint.
Transitions run per property with their own duration/timing;
interruptions continue from the current blended value. Keyframe
`var()`/`light-dark()` re-resolves on scheme/custom-property changes
without restarting the animation. Deviation: no `transition-delay` /
`animation-delay`.

## Values, functions and at-rules

- Units: `cell`/`ch`, `%`, unitless `0`, `fr` (grid). Everything
  pixel-derived is dropped (see below).
- [`var()`](https://developer.mozilla.org/en-US/docs/Web/CSS/var) custom
  properties with inheritance and fallbacks.
- [`calc()`](https://developer.mozilla.org/en-US/docs/Web/CSS/calc),
  `min()`, `max()`, `clamp()` over cells and `%`.
- Colours: hex (3/6/8 digit), `rgb()`/`rgba()`, `hsl()`/`hsla()`, `hwb()`,
  `lab()`, `lch()`, `oklab()`, `oklch()` (legacy and modern syntax), all
  148 named colours, `transparent`, `currentColor`,
  [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark).
  Alpha composites at paint time (blends over the cell beneath), and
  numeric `opacity` acts as a blend factor.
- Keywords: `inherit`, `initial`, `unset`.
- At-rules: [`@media`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media)
  (`prefers-color-scheme`, `display-mode`, `min/max-width`, `min/max-height`
  — in cells), [`@container`](https://developer.mozilla.org/en-US/docs/Web/CSS/@container)
  (size queries against the nearest laid-out ancestor),
  [`@supports`](https://developer.mozilla.org/en-US/docs/Web/CSS/@supports)
  (property-name checks), `@keyframes`. Nested rules inside declarations
  (`& {}`-less media nesting) are supported.

## Ignored (no cell-grid meaning)

These parse and are dropped silently. Use `@media (display-mode: browser)`
for the browser-side styling and a terminal-native equivalent if needed.

`px`/`em`/`rem`/`ex`/`vw`/`vh` lengths · `font-size`, `font-family`,
`line-height`, `letter-spacing`, `word-spacing` · `border-radius` (use
`border: rounded`), `box-shadow`, `outline`, `filter`, `backdrop-filter` ·
`transform` and friends · `background-image`, gradients · `float` ·
`@font-face`, `@page`.
