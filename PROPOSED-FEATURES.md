# Proposed features for svelterm

> **Superseded by [PLAN-NEXT.md](PLAN-NEXT.md) (2026-07-06).** Most items
> below shipped in 0.23.0–0.28.0 (relative/sticky offsets, sibling
> border-collapse, grid-auto-flow column, minmax redistribution, form
> attributes, motion timing, and the whole inline-flow arc); selection
> already existed (0.6.0); border-title was decided OUT of core. The
> few still-open items were folded into PLAN-NEXT.md. Kept for the
> original side-by-side analysis notes only.

Written 2026-07-05, from a side-by-side comparison with sumi (the Go sibling
framework; see `~/projects/sumi/COMPARISON-svelterm.md` for the full analysis).
Three sources: features sumi has that svelterm lacks, gaps svelterm's own docs
admit to, and gaps in @svelterm/ui found while inventorying it.

## From sumi (features it has that svelterm doesn't)

- **`border-title`** — a title embedded in the top border (`┌─ Title ──┐`),
  literal or reactive. Sumi's most distinctive visual feature; the natural CSS
  surface would be a `border-title` property or a `::border-title`-ish
  mechanism, but an attribute on the element may be more honest. Pairs with
  border-collapse below for tmux-style panel UIs.
- **Inter-box `border-collapse`** — adjacent sibling boxes sharing border lines
  with proper junction characters (`├`, `┬`, `┼`), tmux-style. Svelterm has
  border-collapse for tables only; sumi does it for any adjacent bordered
  boxes with a 4-bit junction lookup table worth porting.
- **`position: relative` offsets applied** — svelterm establishes the context
  but drops the offsets (documented known gap in `reference.md`). Sumi applies
  them; there's no cell-grid reason not to.
- **`position: sticky`** — sumi supports Y-axis sticky inside scroll
  containers. Useful for headers in scrollable lists/logs.
- **Rich text editing in `input`/`textarea`** — sumi's textedit engine has
  undo/redo stacks, a kill buffer (Ctrl+K/Ctrl+Y), word-boundary ops,
  selection with shift+movement, double-click word select, cut/copy,
  `maxlength`, `readonly`, and password masking (`type="password"`).
  Svelterm's editors are readline-style but thinner; password inputs and
  maxlength are table stakes for form parity.
- **Deterministic animation clock for tests** — sumi drives its animation
  engine through a `Clock` interface with a `TestClock`, so animation and
  transition tests are exact, not timing-dependent. Svelterm's ~30fps
  interval-driven animation would benefit from the same seam.
- **Scenario-driven E2E protocol** — sumi exposes a control socket
  (info/step/quit) so a harness can drive a running app deterministically and
  assert on the emulated screen. Svelterm has headless rendering; the missing
  piece is scripted multi-step interaction with frame-by-frame assertions.

## Svelterm's own documented gaps worth promoting to work items

(All stated in `docs/reference.md` / chapter docs as known deviations.)

- `grid-auto-flow: column`.
- `minmax()` fractional minimums enforced with proper redistribution.
- `::before`/`::after` inside table-internal boxes.
- `counter()` in `content:`.
- Per-keyframe `animation-timing-function` overrides.
- Per-property `transition-duration`/`timing-function` (currently one value
  applies to all listed properties).
- Interrupted transitions continuing from current value rather than
  restarting from the previous target.
- Keyframe `var()`/`light-dark()` re-resolution (currently resolved once at
  animation start; scheme flips mid-animation don't take).
- Easing for cell-length interpolation (lengths currently step linearly per
  the whole-cell rule, but the *timing* of steps could honour easing — the
  skill notes "NO easing" for step timing).

## Docs

- **Reconcile `reference.md` with `elements.md` on images.** The reference
  matrix still says `img` is "not rendered"; `elements.md` documents
  half-block rendering plus kitty graphics. The reference is the page people
  trust — update it (and keep a rule that reference.md changes land in the
  same commit as the feature).

## @svelterm/ui

- **Tabs keyboard navigation** — List and FuzzyPicker have arrow-key nav;
  Tabs is mouse/click-only. Arrow keys + Home/End on the tab bar.
- **Dialog behaviour where it's claimed** — README/CHANGELOG advertise focus
  trap and Escape-to-close, but the component relies entirely on the
  renderer's `<dialog>`. Either document that or add explicit handling
  (initial-focus targeting, focus restore on close).
- **Component behaviour tests** — logic modules (color/fuzzy/toast) are well
  tested; components only have a compile smoke test. Headless-render tests
  for keyboard nav, binding, and events would catch regressions the compile
  test can't.
- **Form primitives** — there's no standalone Button/Checkbox/Select/Field
  wrapper; FuzzyPicker embeds a raw `<input>`. A small form kit (labelled
  field, validation message slot) would round out the library.
- **Theming hooks** — colours are hardcoded per component. Exposing CSS
  custom properties (`--ui-accent`, `--ui-danger`, …) with `light-dark()`
  defaults would make the library themeable without forking styles.
- **A List virtualisation option** — long lists currently render every item;
  a windowed mode matters for file pickers and log viewers.

## Cross-pollination candidates (bigger, discuss first)

- **Inline images in the flow** — already planned per reference.md; sumi is
  planning half-block + kitty too, so agreeing shared semantics (sizing in
  cells, aspect handling, fallback) would keep the two frameworks compatible.
- **A shared demo/example corpus** — both frameworks express near-identical
  examples (counter, panels, forms, animations). A common set of specs would
  make behavioural differences visible and serve as acceptance tests for
  both sides.
