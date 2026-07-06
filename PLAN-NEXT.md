# PLAN-NEXT — @svelterm/core after 0.28.0

Written 2026-07-06 after the inline-formatting-context arc
(DESIGN-inline-flow.md, 0.28.0); design questions settled with Tom the
same day — every arc below is unblocked and can be executed without
stopping for decisions. Work each arc with the usual loop: design doc →
carpaccio slices → red/green/refactor → commit+push per slice.

## Corrections to the first draft of this plan

- **Selection + clipboard: already done — no arc.** Svelterm has had
  screen-space global selection since 0.6.0 (`src/input/selection.ts`:
  drag ribbon, double-click word, triple-click line, inverse-video
  paint, OSC 52 + platform clipboard tool). Sumi's D5 (05b89b7) was the
  port of svelterm's model TO sumi, not the reverse.
- **border-title: not a core feature (Tom, 2026-07-06).** It feels like
  UI-library territory rather than core, and is skipped entirely for
  now — no core CSS property, no near-term work. If it returns, it
  returns as an @svelterm/ui panel-with-title component. (Sumi keeps its
  own core `border-title` property; the frameworks deliberately diverge
  here.)

## Arc 1 — text-editing parity in input/textarea

**Decision (Tom, 2026-07-06): mirror sumi's textedit wholesale.** Same
keymap and semantics; where a chord conflicts with an existing svelterm
binding, resolve in sumi's favour where possible. Copy the concrete
bindings from sumi's implementation (`~/projects/sumi/runtime/layout/
cursor_editable.go`, `directwrite.go`, textedit tests) — do not
redesign them.

Scope beyond 0.27.0's attribute slice: undo/redo stacks, kill buffer
(Ctrl+K/Ctrl+Y), word-boundary ops, shift+movement selection,
double-click word select, cut/copy integration with the existing
clipboard plumbing.

Slices:
1. Word-boundary ops (word left/right, delete word) — RED against
   sumi's boundary semantics.
2. Shift+movement selection + cut/copy of the field selection.
3. Kill buffer (Ctrl+K/Ctrl+Y) sharing the selection/clipboard code.
4. Undo/redo stacks (chords as in sumi).
5. Docs + changelog + version bump.

## Arc 2 — scenario-driven E2E protocol

**Decision (Tom, 2026-07-06): extend the existing debug server** (0.17.0
svt CLI / 0.20.0 devtools plumbing) rather than adding a sumi-style
second control socket. One protocol serves tree inspection AND scripted
interaction.

Shape: harness sends input events + waits for a frame + asserts on the
emulated screen (headless rendering already exists). Slices:
1. Debug-server commands: inject key/mouse events into the run loop.
2. Frame synchronisation: "step until next paint settles" + screen
   snapshot over the socket.
3. Assertion helpers in the test harness (screen text/cell queries).
4. One end-to-end scenario test of a real demo as the acceptance proof.

## Arc 3 — IFC v1 limits (only if something real trips on them)

Deliberate scope cuts in DESIGN-inline-flow.md, matching sumi's v1 —
don't build speculatively; promote when a real component or demo hits
one, and port sumi's approach if it lifts a limit first:

- `display:inline` elements are style-only in an IFC (border/padding/
  horizontal margin ignored).
- `white-space: nowrap|pre` text leaves the IFC and stacks block-level.

## Housekeeping (small, any time)

- **PROPOSED-FEATURES.md is superseded by this file** — a banner at its
  top says so; the still-relevant items were folded in here, everything
  else in it had already shipped (0.23.0–0.28.0).
- **Svelte fork**: drop the local fork commit when Paolo ships the
  custom-renderer export condition (upstream #18505 closed in favour of
  it; he wants a Discord chat — see memory).
- **Demos** (PLAN.md wishlist): file browser, markdown viewer, colour
  palette, svmux multiplexer, sveditor. Good showcases for Arc 1's
  editing work.
- **Docs/community**: architecture blog post; "why CSS for terminals".

## Pending user-side actions (not code)

- Promote staged `@svelterm/ui@0.3.1` on npmjs.com (experimental
  disclaimer README; workflow staged it 2026-07-06).
- Deploy svelterm-site (`aws sso login --profile tyanroot`; `build/` is
  current: light-theme lift + UI surfaces hidden from production).
- Optional: ignore or delete the failed v0.28.0 publish workflow run
  (expected conflict — 0.28.0 was already live; guard added in 6724b98
  applies to future tags).
