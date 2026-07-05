# Terminal CSS

The terminal-specific surface: what svelterm adds to CSS, and how familiar
properties map onto a character grid. Everything here is invalid or inert
in browsers by design — the same stylesheet runs in both modes.

## The `cell` unit

One terminal cell is the atomic unit of layout:

```css
.sidebar { width: 24cell; padding: 1cell 2cell; }
```

- [`ch`](https://developer.mozilla.org/en-US/docs/Web/CSS/length#ch) is an
  exact alias (`1ch` = `1cell`). Prefer `ch` in dual-target stylesheets —
  browsers understand it too, and on a monospace grid it means the same
  thing.
- All lengths round to whole cells; `4.6cell` is 5.
- Unitless `0` is valid, as in CSS. `%` is relative to the containing
  block's cells. `fr` works in grid templates.
- Pixel-derived units (`px`, `em`, `rem`, `vw`, `vh`…) parse and are
  dropped — see [compatibility](./compatibility.md).

## Targeting one mode

svelterm evaluates `@media (display-mode: terminal)` as true; a
`display-mode: browser` block is ignored by the terminal and applies in
real browsers as plain CSS:

```css
.card {
    @media (display-mode: browser)  { box-shadow: 0 2px 8px #0004; }
    @media (display-mode: terminal) { border: single; }
}
```

This is the documented pattern for everything svelterm deliberately
ignores (shadows, radii, fonts, transforms).

## Borders

[`border-style`](https://developer.mozilla.org/en-US/docs/Web/CSS/border-style)
takes terminal-native values drawn with box-drawing and block glyphs.
Browser values (`solid`, `dashed`…) are ignored.

| Value | Look |
|---|---|
| `single` | `┌─┐` light box drawing |
| `double` | `╔═╗` double lines |
| `rounded` | `╭─╮` rounded corners |
| `heavy` | `┏━┓` heavy lines |
| `ascii` | `+-+` plain ASCII |
| `eighth-cell-inner` / `-outer` | thin eighth-block edges inside/outside the cell |
| `half-cell-inner` / `-outer` | half-block edges |
| `full-cell` | full-block frame |

- Borders are exactly one cell thick and consume layout space.
- Individual sides: `border-top: true` / `false` (setting one side first
  disables the others).
- `border-corner: h | v | none` biases which line wins at corners.
- `border-color` is standard, including `currentColor`.
- Tables support `border-collapse: collapse` with shared grid lines.
- `border-collapse: collapse` extends beyond tables: on any container
  (it inherits, so `:root` opts the whole app in), adjacent bordered
  siblings — stacked blocks, flex items, grid items — share a single
  border line, merging into junction glyphs (`├` `┬` `┼`) in the border's
  family. Without it, sibling frames stay separate as in browsers.
  `border-collapse: separate` on a child opts it back out.

```css
.panel  { border: rounded; border-color: cyan; }
.rule   { border-top: true; border-style: single; }  /* horizontal rule */
.list   { border-collapse: collapse; }  /* children share dividers */
```

## Colour

Resolved colours are ANSI palette names or 24-bit truecolor:

- The 8 basic CSS keywords (`red`, `cyan`, …) map to ANSI palette names —
  the user's terminal theme can restyle them.
- Hex, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`
  and the 148 named colours resolve to exact truecolor.
- `transparent` means "no colour set": the parent's background shows
  through. There is no alpha blending.
- `currentColor` works wherever a colour is valid.

### Dark/light schemes

The terminal's own scheme is detected by polling OSC 11 (override with
`run({ colorScheme })` or `setColorScheme()`). It drives both:

```css
:root { color-scheme: light dark; }
.hint { color: light-dark(#64748b, #94a3b8); }
@media (prefers-color-scheme: dark) { .logo { color: cyan; } }
```

[`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)
is usually the shortest way to theme a component for both schemes.

## Alpha and opacity

Terminals have no alpha layer, so svelterm composites at paint time:
`rgba()`, `#rrggbbaa` and slash-alpha colours blend over whatever the
cell already holds, and numeric `opacity` folds into the element's
colours as a blend factor. Blending over ANSI colour names uses their
nominal xterm values; blending over the terminal's *default* background
assumes black — set an explicit background on an ancestor when
compositing in light themes.

```css
.overlay { background: rgb(0 0 0 / 0.4); }   /* darkens what's beneath */
.muted   { opacity: 0.6; }                    /* blends toward the bg */
```

The non-standard `opacity: dim` applies the terminal's *dim* attribute
instead of blending. Animating `opacity` switches discretely — animate a
colour toward the background for a smooth fade.

## Text attributes

`font-weight: bold`, `font-style: italic`, `text-decoration: underline`
and `line-through` map to terminal attributes. `text-transform`,
`text-align`, `white-space` (`normal`/`nowrap`/`pre`), `word-break`
(`normal`/`break-all`), and `text-overflow: ellipsis` (plus non-standard
`ellipsis-middle`, which keeps both ends of long paths) behave as
standard. Font *choice* and *size* are the terminal emulator's business —
`font-family`, `font-size`, `line-height` are ignored.

Text is measured in **grapheme clusters and cell widths**: CJK and
fullwidth characters occupy two cells, emoji (including ZWJ sequences)
two, combining marks zero — so `1ch`-based layouts, wrapping, truncation
and borders stay aligned with non-Latin content. Caveat: emoji width
ultimately depends on the terminal's font; svelterm follows the modern
two-cell convention.

## `<svt-ansi>`

Raw ANSI passthrough for pre-styled output — `git diff`, `ls --color`,
build logs. Its text content renders with its own SGR styling (16/256/
truecolor, bold, underline, …); non-SGR escape sequences are stripped.
Content is treated as `pre`: newlines split lines, tabs expand to
8-column stops, nothing wraps.

```svelte
<svt-ansi>{diffOutput}</svt-ansi>
```

## `<svt-region>`

A paint primitive whose cells come from your code — used to embed whole
terminal emulators (the playground's embedded-terminal demo). It fills its
box like a replaced element, receives a cell-source callback, and fires
`resize` with `{ cols, rows }` when its allocated size changes.
