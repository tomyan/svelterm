# Layout

svelterm implements the CSS layout models that make sense on a cell grid:
block/inline flow, flexbox, grid, tables, and positioning. Lengths are
cells; behaviour follows the specs linked below unless a grid deviation is
noted.

## Box model

[Box model](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model)
as standard: `width`/`height` (+ `min-`/`max-`), `padding`, `margin`
(including `margin: auto` centring and vertical
[margin collapse](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model/Mastering_margin_collapsing)),
`box-sizing: border-box | content-box`. Borders are 1 cell thick when
present.

`overflow: hidden | scroll | auto` clips, and scrollable boxes really
scroll — mouse wheel, with fading scrollbar overlays. `text-overflow:
ellipsis` needs the usual `white-space: nowrap; overflow: hidden`.

Scrolling is O(visible): subtrees outside the clip are culled from the
paint walk, so a 10,000-row list repaints in ~1.5 ms per scroll step
(initial layout still visits every row once). No windowing API needed —
put long content in an `overflow: auto` box and scroll it.

When the whole viewport scrolls (a fullscreen list, streaming inline
output), the diff detects the vertical translation and emits a DECSTBM
scroll-region command instead of rewriting every cell — an 80×40 screen
scrolled one line is ~13× less output, which shows on slow links.

## Display and flow

`display: block, inline, inline-block, flex, grid, none, contents` and
the full set of table display types. Inline elements flow horizontally
and wrap; whitespace between inline siblings is preserved, between block
siblings collapsed — matching browser text flow.

## Flexbox

[Flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout)
support: `flex-direction` (all four), `flex-wrap`, the `flex` shorthand
and `flex-grow`/`flex-shrink`/`flex-basis`, `gap`, `justify-content`
(including the `space-*` distributions), `align-items`, `align-self`,
`order`.

```css
.toolbar { display: flex; gap: 1ch; justify-content: space-between; }
.spacer  { flex: 1; }
```

## Grid

[Grid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)
support:

- `grid-template-columns` / `grid-template-rows` with `cell`/`ch`, `%`,
  `fr`, `repeat()`, and `minmax()`.
- Placement: `grid-column` and `grid-row` (`start`, `start / end`,
  `span n`), numeric `grid-area` (`r1 / c1 / r2 / c2`).
- Named areas: `grid-template-areas` with `grid-area: name`; `.` is a
  hole; a repeated name spans its rectangle. Without a column template,
  areas split the width evenly.

```css
.app {
    display: grid;
    grid-template-columns: 20ch 1fr;
    grid-template-rows: 1ch 1fr 1ch;
    grid-template-areas:
        "header header"
        "nav    main"
        "footer footer";
}
.nav { grid-area: nav; }
```

Deviations: auto-flow is row-based (`grid-auto-flow: column` is not
implemented); `minmax()` minimums on `fr` tracks are enforced without
redistribution; spanning content doesn't stretch individual tracks.

## Tables

Full [CSS table layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_table):
`<table>`/`<thead>`/`<tbody>`/`<tfoot>`/`<caption>`/`<colgroup>`,
`colspan`/`rowspan`, `table-layout: auto | fixed`, `border-spacing`,
`caption-side`, `empty-cells`, and `border-collapse: collapse` drawn with
shared box-drawing grid lines. Anonymous boxes are generated for stray
content. `vertical-align: baseline` is treated as `top` (one line of
cells has no baseline distinct from its top).

## Positioning

`position: absolute` and `fixed` take elements out of flow and place them
by `top`/`right`/`bottom`/`left` with `z-index` stacking. `position:
relative` establishes context but **offsets are not applied** — a known
gap. Sub-cell geometry (`transform`, floats) is out of scope; see
[compatibility](./compatibility.md).

## Sizing behaviours worth knowing

- Blocks fill their container's width; inline-blocks shrink-wrap.
- `input`/`textarea`/`select` have a minimum height of one row;
  `<select>` sizes to its longest option plus the `▾` indicator;
  checkboxes/radios are 3×1; `progress`/`meter` default to 20×1.
- `@container` size queries evaluate against the nearest laid-out
  ancestor, in cells.
