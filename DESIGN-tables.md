# CSS Tables — Design / Brief

Implement HTML `<table>` and CSS `display: table*` according to the CSS 2.2 spec, validated against [WPT](https://github.com/web-platform-tests/wpt) test cases. One playground demo accumulates features as slices land.

This document is intended to be readable cold by a fresh agent after `/clear`. It carries the full plan and pointers into the codebase.

## Goal

`<table>` and `display: table*` should produce sensible terminal output for the kinds of tabular data CLI tools render: process lists, file listings, configuration tables, dashboards. Behaviour should follow the CSS 2.2 table model so that authors familiar with HTML tables get predictable results.

The test harness ports relevant cases from [WPT `css/css2/tables/`](https://github.com/web-platform-tests/wpt/tree/master/css/css2/tables) and [`css/css-tables/`](https://github.com/web-platform-tests/wpt/tree/master/css/css-tables). Each ported test names its WPT source, so behaviours can be cross-referenced against the spec.

## Status — what exists today

Partial implementation already in place. Read the current code before starting:

- `src/layout/engine.ts:431` — `layoutTable(node, …)`. Two-pass auto-width algorithm; positions cells L→R; hardcoded 2-cell column gap; doesn't recognise `<thead>/<tbody>/<tfoot>` (only direct `<tr>` children).
- `src/css/compute.ts:30` — `display` type already includes `'table' | 'table-row' | 'table-cell'`.
- `src/css/compute.ts:90` — default-display map: `table → table, tr → table-row, td → table-cell, th → table-cell`. **Missing**: thead/tbody/tfoot/caption/col/colgroup mappings.
- `src/css/compute.ts:416` — `display` value parser accepts `'table' | 'table-row' | 'table-cell'`. **Missing**: the other six table display values.
- `src/render/border.ts:5-24` — `BorderChars` with full junction glyphs (`teeLeft/Right/Top/Bottom`, `cross`) for `single`, `double`, `rounded`, `heavy`. The renderer **already does adjacency-based glyph merging** between siblings via `mergeCorner` (line 145+) — this means slice 5 (`border-collapse`) is meaningfully closer than it sounds; we just need cells in a collapsed table to *be* adjacent borders that the existing code can detect and merge.
- `test/integration/table.test.ts` — two passing tests: basic positioning and column widest-cell sizing.
- `src/css/defaults.ts` — user-agent stylesheet. **Add** default `<th>` styling and any HTML defaults for tables here.

## Reference standards

- [CSS 2.2 §17 Tables](https://www.w3.org/TR/CSS22/tables.html) — primary reference for layout, anonymous boxes, border models.
- [CSS Tables Module Level 3](https://drafts.csswg.org/css-tables-3/) — descriptive, but mostly unimplemented in browsers; only consult where 2.2 is ambiguous.
- WPT — see above. Port cases that exercise the spec, naming each test with its WPT path:

```ts
// WPT: css/css2/tables/table-anonymous-objects-001.html
it('wraps stray <td> in anonymous <tr> and <table>', () => { ... })
```

## In scope — every feature required for "complete"

This is the full list. Anything not here is out of scope (small list at the bottom).

### Element recognition

- `<table>` → `display: table`
- `<thead>` → `display: table-header-group`
- `<tbody>` → `display: table-row-group`
- `<tfoot>` → `display: table-footer-group`
- `<tr>` → `display: table-row`
- `<th>`, `<td>` → `display: table-cell`
- `<caption>` → `display: table-caption`
- `<colgroup>` → `display: table-column-group`
- `<col>` → `display: table-column`

All values accepted by the CSS parser. All routed correctly through `layoutTable`. Custom elements with these `display` values laid out the same way as their HTML counterparts.

### Display values

- `display: table` (block-level)
- `display: inline-table` (inline-block container, non-fill width)
- `display: table-{row,row-group,header-group,footer-group,cell,column,column-group,caption}`

### Anonymous box generation (CSS 2.2 §17.2.1)

When the source tree is missing required structure, generate it virtually:

- A stray `<td>` inside any non-table-row parent → wrapped in anonymous `<tr>`.
- A stray `<tr>` outside a table-row-group → wrapped in anonymous `<tbody>`.
- A stray row-group outside a table → wrapped in anonymous `<table>`.
- Misplaced inline-flow content (text) inside a table-row → wrapped in anonymous `<td>`.

These rules are non-trivial; port WPT `table-anonymous-objects-*` tests to drive them.

### Section ordering (CSS 2.2 §17.5.2)

Regardless of source order:

1. Caption (above table by default; `caption-side: bottom` puts it below)
2. Column groups
3. Header (`thead`)
4. Body (`tbody`, in source order if multiple)
5. Footer (`tfoot`)

### Default styling

Add to `src/css/defaults.ts`:

```css
th { font-weight: bold; text-align: center; }
caption { text-align: center; }
table { border-collapse: separate; border-spacing: 1cell; }
```

(Note: HTML's default `border-spacing` is `2px` ≈ ~0 cells in our model. `1cell` reads better in terminal rendering. Open to revisiting if WPT tests require `0`.)

### Spans

- `colspan` attribute on `<td>` / `<th>` (default 1)
- `rowspan` attribute on `<td>` / `<th>` (default 1)
- `colspan="0"` (span all remaining columns) — verify behaviour against WPT
- The column-width pass must:
  - Track which cells are spanning into subsequent rows (build a logical occupancy grid)
  - Distribute span'd cell widths sensibly (CSS 2.2 §17.5.2.1: "minimum and maximum width of each column" account for spans)

### Column sizing

- `<colgroup>` and `<col>` recognised; `width` and `span` attributes honoured.
- CSS `width` on cells, `<col>`, `<colgroup>`, and `<th>` honoured during column-width resolution.
- `table-layout: auto` (CSS default; current behaviour, refined): two-pass min-content and max-content distribution per CSS 2.2 §17.5.2.2.
- `table-layout: fixed`: column widths from first row / `<col>`s; remaining columns share leftover; cell content does **not** influence column widths in this mode.
- Both algorithms should produce the same output as Chromium for the WPT cases we port.

### Row sizing

- Row height = max of `min-content` height of cells in the row + spanning cells' minimums.
- CSS `height` on `<tr>` and on cells honoured as a minimum.
- `<tr>` is a single visual row — wrap behaviour comes from cell content overflowing.

### Cell content layout

- Cell content wraps when narrower than content's natural width.
- `vertical-align: top | middle | bottom | baseline` on cells. (Baseline approximated as top in cell terminal model — document the limitation.)
- `text-align` on cells works (already does via inheritance).
- `<th>` defaults `text-align: center` (per `defaults.ts` change above).

### Borders — separate model (default)

`border-collapse: separate` — current behaviour. Each cell renders its own border using `border-style`, with `border-spacing` between cells.

- `border-spacing: <length>` — gap between adjacent cell borders, both axes.
- `border-spacing: <h> <v>` — different horizontal/vertical spacing.
- `empty-cells: show | hide` — `hide` suppresses borders on cells with no content.

### Borders — collapse model

`border-collapse: collapse` — merge adjacent cell borders into shared grid lines.

- Cells lose individual margins; shared edges paint a single character.
- Junction characters at intersections from the existing `BorderChars` table — corner, T-, and cross-junctions selected from the four neighbour flags (up/down/left/right).
- Conflict resolution per CSS 2.2 §17.6.2.1: hidden > none > thicker style > more specific source. We only need a sensible subset; document where we deviate.
- Reuse the existing `mergeCorner` adjacency machinery in `src/render/border.ts` — extend it to know about full grid-line patterns produced by `layoutTable`.

### Caption

- `<caption>` rendered above the table (default `caption-side: top`).
- `caption-side: bottom` rendered below.
- Caption width = table width.
- Caption participates in the table's outer box.

### Border style: `ascii`

Add `ascii` to the existing `border-style` lookup in `src/render/border.ts`:

```ts
ascii: { topLeft: '+', topRight: '+', bottomLeft: '+', bottomRight: '+',
         horizontal: '-', vertical: '|',
         teeLeft: '+', teeRight: '+', teeTop: '+', teeBottom: '+', cross: '+' }
```

CSS-level — per-element overridable, no new runtime option, no new CSS extension. Switching `<table>` from `border-style: single` to `border-style: ascii` swaps the entire glyph set with no other changes. Author can mix: e.g. `<table>` ASCII outer, `<td>` unicode inner — but expect that to look weird; the demo will use one consistent style.

## Out of scope

Tightly bounded:

- `border-collapse: collapse` conflict resolution beyond the subset above.
- `direction: rtl` / right-to-left tables.
- `vertical-align: baseline` true baseline alignment (approximated as top).
- Multi-page tables / row repetition across page breaks (we have no page concept).
- Per-element override of border charset via CSS variable.
- `<col>` / `<colgroup>` background painting under cells (CSS 2.2 §17.5.1 paints them in a defined Z-order — terminal cells are flat, so this collapses; just paint the cell's own bg).
- `caption-side: left | right` (CSS 3 only).

## Architecture sketch

I expect the work to settle into roughly this shape — final factoring decided during slices. Don't pre-commit to abstractions; refactor in the green→refactor step of TDD.

1. **Table-tree normalisation** (`src/layout/table-model.ts` — new file, suggested):
   - Walk a `<table>` (real or anonymous) and produce a flat sectioned list: caption, column-groups, header rows, body rows, footer rows.
   - Generate anonymous wrappers per CSS 2.2 §17.2.1.
   - Resolve colspan/rowspan into a logical occupancy grid (`Cell[][]` with sentinels for spanned-over slots).

2. **Column resolution** (`src/layout/table-cols.ts` — new file, suggested):
   - Auto algorithm vs fixed algorithm, both producing `colWidths: number[]`.
   - Account for explicit widths on `<col>` / `<th>` / `<td>`.

3. **Row positioning** (in `engine.ts`, expanded `layoutTable`):
   - Iterate sections in render order (caption → colgroups → thead → tbodies → tfoot).
   - For each row: lay out cells with resolved widths, compute row height, apply vertical-align.
   - Layout anonymous boxes for column groups (CSS Z-order; for us a no-op except for backgrounds).

4. **Border rendering** unchanged for `separate`. For `collapse`, ensure adjacent cells share an edge and let the existing `mergeCorner` adjacency code do its thing — verify with snapshot tests.

## Slices

Red-green-refactor each one. Commit each. The single playground example `tables` accumulates features.

### Slice 1 — Sections + caption + th defaults

- Default-display map for thead/tbody/tfoot/caption/col/colgroup.
- `display` parser accepts new values.
- `layoutTable` walks rows from the section structure, in render order (header → body → footer regardless of source order).
- Caption rendered above table.
- `<th>` styled bold + centred via `defaults.ts`.
- WPT tests to port: `table-row-grouping-001`, `table-caption-001`, `th-001` if present.
- Add `examples/tables.txt` to playground with a basic header-row table.

### Slice 2 — Spans

- Build occupancy grid in normalisation step.
- `colspan` and `rowspan` honoured during column width and row positioning.
- WPT tests: `table-cell-colspan-001`, `table-cell-rowspan-001`, `table-cell-colspan-zero-*`.
- Demo updated to include a spanned group header.

### Slice 3 — Explicit column sizing + table-layout: fixed

- `<colgroup>` / `<col>` recognised, `width` honoured.
- `table-layout: fixed` algorithm.
- WPT: `table-layout-fixed-*`, `table-col-width-*`.
- Demo updated to mix fixed + auto columns.

### Slice 4 — Vertical-align + row heights

- `vertical-align: top | middle | bottom` on cells.
- Explicit `height` on `<tr>` honoured as minimum.
- WPT: `table-cell-vertical-align-*`.
- Demo updated to show varied row heights with mixed vertical-align.

### Slice 5 — `border-collapse: collapse` + `border-spacing` + `empty-cells` + `border-style: ascii`

- `border-collapse: collapse` algorithm: produce shared grid-line buffer paints; reuse existing junction merge.
- `border-spacing` for the separate model.
- `empty-cells: hide` skips border render for empty cells.
- New `border-style: ascii` glyph set in `BORDER_SETS`.
- WPT: `border-collapse-*`, `border-spacing-*`, `empty-cells-*`.
- Demo updated to use `border-collapse: collapse`. Include a small example of ASCII style somewhere visible.

### Slice 6 — `display: inline-table` + anonymous box generation

- `inline-table` lays out as an inline-block whose contents are a table.
- Anonymous box rules: stray `<td>` / `<tr>` / inline content wrapped at layout time per §17.2.1.
- WPT: `table-anonymous-objects-*`.
- This slice is largely about robustness — the demo doesn't change, but tests grow significantly.

### Slice 7 — Polish + final demo

- Iterate on the demo until it exercises every feature in one realistic dashboard layout: caption, thead/tbody/tfoot, colspan group header, rowspanned row label, mixed fixed/auto columns, vertical-align variations, collapsed unicode borders, default `<th>`. A small ASCII-style table fragment included.
- Sweep for missed WPT cases. Port any that fail and fix.
- Update README / examples list ordering: `tables` sits between `grid` and `embedded terminal`.

## Acceptance for the whole feature

1. Every slice's integration tests pass.
2. The playground `tables` example demonstrates: caption, thead/tbody/tfoot, colspan + rowspan, fixed + auto column widths, vertical-align top/middle/bottom, `border-collapse: collapse` with unicode glyphs (specifically `single`), default `<th>` styling. The example also includes a small visible piece using `border-style: ascii` so both glyph sets are demonstrable.
3. `<table>` / cell elements wrapped in `<div style="display: table">` (and analogous for the parts) lay out identically to their HTML counterparts.
4. WPT-ported tests pass. List of which were ported lives in `test/integration/table.test.ts` as comments.
5. No regression in existing tests (`npm test` in svelterm).
6. The compiled bundle still loads in the playground iframe (no breakage of `iframe/src/runtime.ts` import paths).

## Working notes

- **TDD discipline**: write the failing test first for each slice. Use the harness in `test/integration/harness.ts` (already used by existing table tests). Snapshot-style assertions are fine for visual layout; prefer specific cell-position assertions for behavioural guarantees.
- **WPT porting**: don't try to port the entire WPT corpus. For each slice, pick ~3–5 representative cases. The WPT HTML is more capable than our renderer (e.g. cellspacing attributes, deep `<colgroup>` graphs), so port the *behaviour under test*, not the source HTML verbatim.
- **Anonymous boxes**: defer until slice 6. The earlier slices can assume well-formed input, since the existing code does.
- **Don't over-abstract early**: layoutTable is currently 60 lines. By the end it might split into 3 files. But don't pre-create those files in slice 1 — let the natural seams emerge during refactor steps.
- **Demo iteration**: re-test the demo in the playground after each slice. The dev server is `npm run dev` from `/Users/tom/projects/svelterm-site/`. Reload via hubcap or browser refresh. The example file is `src/lib/examples/tables.txt`.

## Pointers

Existing related design docs:

- `DESIGN-border-styles.md` — block-character border styles, history of how the `BORDER_SETS` table is organised.
- `DESIGN-css-colors.md` — colour parsing, relevant if cells / rows need bg.
- `DESIGN.md` — high-level architecture.

Codebase paths:

- `src/layout/engine.ts` (especially `layoutTable`, `layoutGrid` for shape comparison)
- `src/render/border.ts` (especially `BORDER_SETS`, `mergeCorner`)
- `src/css/compute.ts` (display map, parser)
- `src/css/defaults.ts` (UA stylesheet)
- `test/integration/table.test.ts` (existing tests, harness usage)
- `test/integration/harness.ts` (`render`, `el`, `text`, `rowText` helpers)

## Build / test commands

```sh
# From /Users/tom/projects/svelterm/
npm test                                  # all tests
npm test -- --grep table                  # tables only
npx tsc --noEmit                          # type check

# Site dev (for demo verification):
# From /Users/tom/projects/svelterm-site/
npm run dev                               # vite + iframe
```
