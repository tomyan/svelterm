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
activate the same defaults. `Ctrl+C` exits.

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
| `input` (text) | single-line editor with cursor, `value`, `input` events | [`<input>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) |
| `input type="checkbox" / "radio"` | glyph toggles; `checked` attribute/property; `change`+`input` events | [checkbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox), [radio](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/radio) |
| `textarea` | multi-line editing | [`<textarea>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/textarea) |
| `button` | focusable, centred text, `click` on Enter/click | [`<button>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/button) |
| `select`/`option`/`optgroup` | cycling control (see above); `change`+`input` with the option value | [`<select>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select) |
| `progress`, `meter` | block-glyph bars; `value`/`max` (+`min` for meter); no-value progress renders track only | [`<progress>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/progress), [`<meter>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meter) |
| `details`/`summary` | ▶/▼ disclosure, `open` attribute, `toggle` event, focusable summary | [`<details>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details) |
| `img`, `video`, `canvas`, `iframe` | **not rendered** (inline images are a planned separate feature) | — |

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
  with `content:` strings, `attr(x)`, space-separated concatenation, and
  `none`/`""`. `counter()` is not supported. Pseudo boxes are inline and
  invisible to `:empty`/`:nth-*`. Known gap: pseudo-elements don't render
  inside table-internal boxes.
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
| [Grid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout) | `grid-template-columns/rows` (`cell`/`ch`/`%`/`fr`, `repeat()`, `minmax()`), `grid-template-areas` + `grid-area` (named and numeric), `grid-column`, `grid-row` (start / start‑end / `span n`), `gap`. Auto-flow is row-based; `grid-auto-flow: column` is not implemented. Fractional `minmax()` minimums are enforced without redistribution |
| [Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/position) | `position: static/absolute/fixed` with `top/right/bottom/left`, `z-index`. `position: relative` establishes context but offsets are **not** applied |
| [Tables](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_table) | `border-collapse`, `border-spacing`, `caption-side`, `table-layout`, `empty-cells`, `vertical-align` (`baseline` ≈ `top`) |
| Borders | `border`/`border-style`/`border-color`/`border-corner` + per-side toggles (terminal values above) |
| [Animation](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations) | `animation` shorthand, `animation-name/-duration/-iteration-count` (incl. `infinite`), `@keyframes` (from/to/percentages) |
| [Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions) | `transition` shorthand, `transition-property` (list or `all`), `transition-duration` |

### Animation & transition semantics on the grid

Colours interpolate in RGB at ~30fps; single cell/ch lengths interpolate
to whole cells (movement steps cell by cell); every other supported
property applies discretely, switching at the segment midpoint (the CSS
rule for non-interpolable values). Layout-affecting animations re-flow
each frame. Deviations: no easing curves (linear only), one duration for
all listed transition properties, interrupted transitions restart from the
previous target value, and keyframe declarations do not resolve `var()`/
`light-dark()` — use literal colours inside `@keyframes`.

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
`@font-face`, `@page` · easing keywords in animations/transitions.
