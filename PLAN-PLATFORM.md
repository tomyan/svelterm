# Platform parity plan — COMPLETE (2026-07-05)

All five arcs shipped: 0.23.0 (positioning), 0.24.0 (motion timing),
0.25.0 (grid & generated content), 0.26.0 (explicit sibling border
collapse — Arc D pivoted: the collapse already existed always-on, so it
became an opt-in via inherited `border-collapse: collapse`, a breaking
change), 0.27.0 (form parity: password/maxlength/readonly). Suite at
1254 green. All npm publishes staged, awaiting manual promotion.

From PROPOSED-FEATURES.md (2026-07-05), filtered by the platform-vs-
framework lens: these are engine features that should be standards-
aligned and behave identically in svelterm and sumi because both
implement web semantics on a cell grid. UI-framework items (Tabs nav,
form kit, theming, list virtualisation) are deliberately out of scope
here; so is `border-title` (no standard exists — needs a shared
convention designed with sumi, not a unilateral pick) and the E2E
scenario protocol (tooling, not platform).

Release discipline per arc as ever: red tests → green → docs +
reference.md in the same commit → changelog → tag + GitHub release
(which auto-*stages* to npm — nothing goes live without manual
promotion).

## Arc A — Positioning (0.23.0)

- [x] `position: relative` — apply `top/right/bottom/left` offsets as a
      visual shift (self + descendants) while flow position/size stay as
      if unshifted, per spec. Currently parsed and dropped.
- [x] `position: sticky` (top, Y-axis) — inside a scroll container, the
      element paints at max(scrolled position, container top + `top`).
      v1 deviations documented: top-only; no push-out at containing-
      block end; hit-testing may lag the stuck position.

## Arc B — Motion timing completeness (0.24.0)

- [x] Per-property `transition-duration`/`transition-timing-function`
      (comma lists pair with transition-property, per spec; currently
      first duration + one timing apply to all).
- [x] Interrupted transitions continue from the *current blended value*
      instead of restarting from the previous target.
- [x] Per-keyframe `animation-timing-function` overrides (a timing
      function declared inside a keyframe applies from that stop).
- [x] Keyframe `var()`/`light-dark()` re-resolution when the scheme or
      custom properties change mid-animation.
- [x] Eased step *timing* for cell-length interpolation (values still
      snap to whole cells; the moment each step fires follows easing).

## Arc C — Grid & generated content (0.25.0)

- [x] `grid-auto-flow: column`.
- [x] `minmax()` fractional minimums with proper redistribution.
- [x] `::before`/`::after` inside table-internal boxes.
- [x] `counter()` / `counters()` in `content:` (list numbering level).

## Arc D — Inter-box border collapse (0.26.0)

- [x] Adjacent bordered sibling boxes share their border line with
      proper junction glyphs (`├ ┬ ┼ ┤ ┴`), tmux-style — svelterm has
      this for tables only; generalise via a junction lookup keyed on
      which arms meet at a cell (port of sumi's 4-bit table approach).
      Opt-in via `border-collapse: collapse` on the common parent.

## Arc E — Form control platform parity (0.27.0)

- [x] `<input type="password">` masking.
- [x] `maxlength` on input/textarea.
- [x] `readonly` (focusable, not editable — distinct from disabled).
      (Undo/redo, kill-buffer depth, and selection-in-inputs are editor
      ergonomics, not standards parity — left for a later pass.)

## Out of scope (and why)

- `border-title` — no standard; needs the svelterm+sumi shared design.
- E2E scenario protocol, shared demo corpus — tooling/process.
- @svelterm/ui items — framework layer, separate plan.
