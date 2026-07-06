# PLAN-NEXT — @svelterm/core after 0.28.0

Written 2026-07-06, immediately after the inline-formatting-context arc
(DESIGN-inline-flow.md, 0.28.0). This is the consolidated backlog of
everything known to be left on base svelterm, ordered by recommended
value. Work each arc with the usual loop: design doc → carpaccio
slices → red/green/refactor → commit+push per slice → re-validate the
next slice.

## Arc 1 — Text selection + clipboard (port of sumi D5)

The recommended next arc. Sumi shipped global text selection + clipboard
in commit 05b89b7 (`~/projects/sumi/runtime/layout/click_fragment_test.go`
neighbourhood; selection maps ranges onto the per-line fragments).
Svelterm 0.28.0's `LayoutBox.fragments` were designed with this in mind,
and OSC 52 clipboard plumbing exists since 0.6.0.

Value: mouse-drag selection over wrapped/styled text, visible highlight,
copy to system clipboard — table stakes for TUIs that show logs/output.

Proposed slices (validate against sumi's actual D5 design before
committing to these):

1. **Selection model + anchor/extent from mouse** — drag start/move/end
   → a document-order range (node id + offset pairs). Hit-testing already
   resolves fragments; extend it to return character offsets within a
   fragment. RED: drag across two wrapped lines yields the right range.
2. **Highlight painting** — selected cells get inverse/selection colours
   at paint time (a paint-layer concern, not layout). RED: highlight
   follows fragments across a wrapped span, not the union rect.
3. **Copy** — selection → plain text (fragment text joined with
   newlines/spaces per line boxes) → OSC 52. Keyboard: a copy chord;
   terminal conventions to decide with Tom (sumi chose its own — check).
4. **Selection in scrollback/scroll containers** — ranges survive
   scrolling; auto-scroll on drag at edges (check what sumi did; possibly
   defer).
5. **Docs + changelog + version bump.**

Design questions to settle with Tom up front: selection colours
(::selection support vs fixed inverse?), whether word/line snap
(double/triple click) is in scope, and inline-mode behaviour.

## Arc 2 — border-title (joint design with sumi)

Deliberately deferred by Tom until it could be designed jointly for both
frameworks. Sumi now has a working implementation
(`~/projects/sumi/runtime/layout/layout_bordertitle_test.go`,
`rendertree_bordertitle_test.go`) to use as the concrete reference.
No CSS standard exists — the design conversation must pick the authoring
surface (a `border-title` property, an attribute, or a pseudo-element
mechanism) and it should be the SAME answer in both frameworks.

**Design-first: do not start slices without the joint design session.**

## Arc 3 — text-editing parity in input/textarea

0.27.0 took only the attribute slice (password masking, maxlength,
readonly). Sumi's textedit engine still has: undo/redo stacks, kill
buffer (Ctrl+K/Ctrl+Y), word-boundary ops, shift+movement selection,
double-click word select, cut/copy. Reference:
`~/projects/sumi/runtime/layout/cursor_editable.go` and textedit tests.
Slices roughly: word ops → shift-selection (+ integrates with Arc 1's
clipboard) → undo/redo → kill buffer.

## Arc 4 — IFC v1 limits (only if real components hit them)

Both were deliberate scope cuts in DESIGN-inline-flow.md, matching
sumi's v1:

- `display:inline` elements are style-only — border/padding/horizontal
  margin are ignored inside an IFC.
- Text with `white-space: nowrap|pre` leaves the IFC and stacks
  block-level (so a nowrap span inside a paragraph gets its own line
  rather than flowing unwrapped).

Don't build speculatively; promote to an arc when a real component or
site demo trips on one. If sumi lifts a limit first, port the approach.

## Arc 5 — scenario-driven E2E protocol

Sumi exposes a control socket (info/step/quit) so a harness can drive a
running app deterministically and assert on the emulated screen frame by
frame. Svelterm has headless rendering and the debug server (0.17.0 svt
CLI, 0.20.0 devtools) — the missing piece is scripted multi-step
interaction. Natural home: extend the existing debug-server protocol
rather than a second socket. Would also make site-demo regression tests
possible.

## Housekeeping (small, any time)

- **Refresh PROPOSED-FEATURES.md** — written 2026-07-05, now half-stale:
  relative/sticky offsets, sibling border-collapse, grid-auto-flow
  column, minmax redistribution, password/maxlength/readonly, and the
  0.24.0 motion-timing items have all shipped. Strike them, fold what
  remains into this file, or delete it in favour of this plan.
- **Svelte fork**: drop the local fork commit when Paolo ships the
  custom-renderer export condition (upstream #18505 closed in favour of
  that; he wants a Discord chat — see memory [[upstream-prs]]).
- **Demos** (PLAN.md wishlist, good Arc-1 showcases): file browser,
  markdown viewer, colour palette, svmux multiplexer, sveditor.
- **Docs/community**: architecture blog post; "why CSS for terminals".

## Pending user-side actions (not code)

- Promote staged `@svelterm/ui@0.3.1` on npmjs.com (experimental
  disclaimer README; workflow staged it 2026-07-06).
- Deploy svelterm-site (`aws sso login --profile tyanroot`; `build/` is
  current: light-theme lift + UI surfaces hidden from production).
- Optional: re-run or ignore the failed v0.28.0 publish workflow run
  (expected conflict — 0.28.0 was already live; guard added in 6724b98
  applies to future tags).
