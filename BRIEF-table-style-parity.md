# Brief — Visual parity for the table demo (backgrounds + borders)

> **Status: done (2026-06-12), pending review + commit.** Findings below; the
> original analysis follows unchanged.
>
> - **Phase A result — no engine bug.** Cell, row, and section backgrounds all
>   paint (section bg propagates via inherited visuals to row boxes). 4
>   regression tests added in `test/integration/table-background.test.ts`.
> - **The real root cause of "demo looks unstyled": the selector engine had no
>   `:where()` support.** The Svelte compiler scopes every descendant selector
>   as e.g. `.data.svelte-x th:where(.svelte-x)`, so *every multi-compound rule*
>   in every example silently dropped in the terminal preview. Also fixed:
>   compounds can now carry multiple pseudo-classes (`td:first-child:where(…)`).
>   `:is()` added alongside. See `src/css/selector.ts`, `src/css/specificity.ts`,
>   `test/selector-where.test.ts`.
> - **Phase B (slice 5) shipped in full:** `border-collapse: collapse` (per-axis
>   track overlap, only where cells are bordered on both sides of a boundary),
>   `border-spacing` (1- and 2-value; UA default `table { border-spacing: 2cell 0 }`
>   replaces the hardcoded col gap), `empty-cells: hide`, `border-style: ascii`.
>   The renderer's corner merging was generalised to direction-mask glyph union
>   (`mergeGlyph` in `src/render/border.ts`), so edges crossing existing lines at
>   span boundaries produce correct junctions.
> - **Phase C shipped:** demo uses `border-collapse: collapse` + heavy accent
>   underline on `th` + single muted separators on `td`, mirroring the browser.
>   Verified side-by-side in the playground.
> - **Not done:** C4 (`:nth-child`) — still open if zebra striping is wanted.
>   `empty-cells`/`ascii` are engine-only so far; design doc slice 7 wants them
>   visible in the demo.

## Problem

The `tables` example in `svelterm-site/src/lib/examples/tables.txt` renders cleanly in the browser (header underline, per-row separators, vertically-centred rowspan cells) but the terminal preview is nearly unstyled — plain text on the terminal background. Side-by-side, "they don't look anything like."

The gap is two-fold:

1. **Backgrounds don't visibly paint on table cells / rows in the terminal.** A `background-color` set on `<th>` (via class or via `var(--head-bg)`) didn't produce any visible tint in the terminal preview when tried.
2. **Borders aren't supported for tables yet.** The browser version uses `border-bottom` on `<th>` (header underline) and on `<td>` (per-row separator). In the terminal these don't render — the renderer's per-cell `renderBorder` would paint each cell's bottom edge as a separate fragment, with the `colGap = 2` showing a visible break between cells. There's no border-collapse glue today.

This brief proposes the smallest plan that closes both gaps.

## Investigation needed (phase A — pre-design)

Before committing to engine work, confirm what's actually happening with backgrounds:

- [ ] Write a focused integration test asserting `<th style="background-color: red">` produces red bg cells in the buffer. If it passes → the engine works; the demo's colours were too subtle. If it fails → there's a real bug in the cell box / paint pipeline for table elements.
- [ ] Check whether the `<tr>` box (set in `placeRows`) paints its background correctly. Same test pattern at the row level.
- [ ] Check whether `<thead>` / `<tbody>` / `<tfoot>` boxes paint their backgrounds. Currently `placeRows` does **not** set boxes for section elements — only `<tr>` and the cells. Section-level backgrounds won't paint without that.
- [ ] If table-cell backgrounds paint but section / row backgrounds don't, decide whether the demo wants per-cell, per-row, or per-section backgrounds.

The result of phase A determines which of the items below need engine work vs. demo work.

## Proposed scope

### Phase A — Backgrounds work and are demonstrated (small)

Engine changes only if the investigation finds a real bug. Likely outcomes:

- **A1.** Section-level backgrounds: set layout boxes for `<thead>` / `<tbody>` / `<tfoot>` covering their span of rows + the table width. Lets `thead { background: ... }` paint a single header-row strip even across multiple `<tr>`s.
- **A2.** Per-row backgrounds on `<tr>`: should already work (row box exists). Test + confirm.
- **A3.** Per-cell backgrounds on `<th>` / `<td>`: should already work (cell box exists, height stretched in slice 4). Test + confirm.

### Phase B — Slice 5 from `DESIGN-tables.md` (the borders piece)

The existing plan in the design doc, scoped to what the demo needs:

- **B1.** `border-collapse: collapse`. Drop the `colGap = 2` to `colGap = 1` (or 0 + 1-cell shared border) so adjacent cells abut. Reuse the existing `mergeCorner` adjacency machinery in `src/render/border.ts` to draw shared grid lines with proper junctions.
- **B2.** `border-spacing` for the separate model — controls the gap when *not* collapsed. Replaces the current hardcoded `colGap = 2`.
- **B3.** `empty-cells: hide` — skip border render on empty cells in the collapsed model. Smaller; can ship later.
- **B4.** `border-style: ascii` — new glyph set in `BORDER_SETS`. Independent of A/B; can land any time.

### Phase C — Demo update

- **C1.** Add `border-collapse: collapse` (terminal mode) so cells abut with shared lines.
- **C2.** Add `thead { border-bottom: single }` to draw the header underline.
- **C3.** Header background (`thead { background: ... }`) — feasible after phase A1.
- **C4.** Optional: `:nth-child(odd)` support in the selector matcher for zebra striping. Currently only `:first-child`, `:last-child`, `:not()`, `:focus`, `:hover`, `:root` are supported (`src/css/selector.ts:264`).

## Open questions

1. **Is the priority backgrounds, borders, or both?** They serve overlapping purposes (visual row separation). If borders alone reach parity, phase A becomes test-only / smaller.
2. **Section-level boxes (A1)** — worth doing even if the immediate demo only needs per-row backgrounds? The table model arguably wants section boxes anyway (for things like `tbody:hover` later).
3. **Should phase B include `border-style: ascii` (B4) now**, or defer to a later slice? It's independent and small but not strictly needed for parity.
4. **`:nth-child` support (C4)** — in or out? It's the cleanest way to do zebra striping that mirrors what people do in HTML/CSS.
5. **Demo aesthetic target** — match the current browser look (header underline + per-row light separators), or rethink toward something more terminal-native (e.g. heavy header underline + clean body)? The existing browser styling could itself be tweaked to land closer to terminal-native conventions.

## Suggested order

1. Phase A investigation (~30 min) → answers question 1 & 2.
2. Phase B1 (`border-collapse: collapse`) — the central feature, biggest payoff.
3. Phase B2 (`border-spacing`).
4. Phase C1 + C2 + C3 — demo update; sanity-check parity in dev server.
5. Phase B3, B4, C4 as follow-ups based on appetite.

## Out of scope (now)

- Conflict resolution beyond a sensible subset for `border-collapse` (per design doc's existing scope).
- True baseline alignment (still approximated as top, per design doc).
- Full WPT corpus — port a few representative cases per phase.
- Touching the in-flight `iframe/index.html` / `Playground.svelte` work in svelterm-site.

## Pointers

- `DESIGN-tables.md` — the umbrella design; this brief sits inside its slice 5, plus adds the backgrounds investigation.
- `src/render/border.ts:5-24, 145+` — `BorderChars`, `mergeCorner` (existing adjacency merging).
- `src/layout/engine.ts:placeRows` — where `<tr>` boxes are set today; section-level boxes would join here.
- `src/render/paint.ts:fillBackground` — paints the bg of an element box. Boxes have to exist for paint to fire.
- `svelterm-site/src/lib/examples/tables.txt` — the demo. Owns the look.
