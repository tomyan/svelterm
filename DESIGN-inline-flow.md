# Inline formatting context — port of sumi's B4 text-layout arc

Status: IN PROGRESS 2026-07-06.
Source: sumi B4 arc (`~/projects/sumi/design-b4-block-inline.md`, commits
6bcf73d..edfb18e + 0899350). All design decisions were resolved with Tom
during the sumi work; this port mirrors them. Reference implementation:
`sumi/runtime/layout/inline.go`, `inline_break.go`, `flow.go`.

## Problem

Svelterm's block flow (`src/layout/engine.ts` `layoutBlockFlow`) measures
each inline child **independently** at a horizontal cursor:

- Text never flows from one inline element into the next across a wrap —
  `a <strong>bb</strong> c` wraps inside each piece separately.
- Wrapped continuation lines indent at cursorX instead of returning to
  the container's left edge; the next sibling starts after the child's
  *widest* line.
- Whitespace is preserved verbatim (no CSS `white-space: normal`
  collapsing); only whitespace-only nodes are dropped in some contexts.
- Paint-time `text-align` shifts every line by the **first** line's
  width (paint-text.ts) — multi-line centering is wrong.
- Hit-testing is box-rect only; text nodes are invisible to it.

Sumi replaced this with a real inline formatting context (IFC). Svelterm
gets the same.

## Design (mirrors sumi's resolved decisions)

### IFC

When a block container's flow children include consecutive inline-level
children, that run forms one IFC laid out as a unit:

1. **Run gathering** — walk the inline subtree depth-first: text nodes
   → text runs (text-transform applied at gather time);
   `display:inline` elements → recurse; `inline-block` → atomic item
   (measured shrink-to-fit via layoutNode). `display:contents` is
   already flattened by block flow.
2. **Inline-level test** — a text node is inline-level unless its
   effective `white-space` is not normal (pre/nowrap text keeps the
   existing block-level path with its ellipsis/truncation behaviour) or
   its parent is `<svt-ansi>`. An element is inline-level if
   `display:inline` and all its visible children are inline-level, or
   `display:inline-block`.
3. **Whitespace collapse** (CSS `white-space: normal`): whitespace runs
   collapse to one space, leading/trailing whitespace per line stripped,
   the breaking space is consumed at a wrap. A whitespace-only IFC
   yields no words → zero height. Snapshot churn accepted.
4. **Line breaking** — words are unbreakable units that can span run
   boundaries (`a<strong>b</strong>` is one word); soft-wrap at
   collapsed spaces; overlong words hard-break at the width; atoms are
   unbreakable. Widths are cell-widths over graphemes (svelterm's
   existing unicode machinery — better than sumi's rune counts; keep).
5. **Fragments** — each text run yields ≥1 `{x, y, text}` rectangles,
   **box-relative**, stored on the text node's LayoutBox
   (`fragments?:`); the box's rect is their bounding rect. An inline
   element's box is the union rect of its descendants' boxes, flagged
   `union: true` (paint skips background fill / borders for union
   boxes — text styling arrives via the existing visuals folding, so
   a span's bg paints per fragment cell). Atoms keep ordinary boxes,
   placed top-aligned at their line slot.
6. **Line boxes** — line height = max item height on the line
   (top-aligned; no baseline, same as sumi). `text-align` shifts whole
   lines within the container's content width at layout time; paint
   does not re-align fragment text.
7. **Painting** — paintTextContent paints `box.fragments` when present
   (per-fragment, no re-wrapping); otherwise the existing path.
8. **Hit-testing** — a box with fragments hits point-in-any-fragment;
   a union box hits only via its descendants. Clicking a wrapped span
   targets it correctly; ragged line-end cells inside the union rect
   fall through to the container.

### Inline element box model (v1 limits, same as sumi)

`display:inline` elements are style-only: border, padding, and
horizontal margin are not applied (svelterm's old cursor path applied
them incidentally; the IFC does not). `inline-block` keeps the full box
model.

### Out of scope

- Baseline / vertical-align in flow (terminal cells make it moot).
- Selection (sumi D5) — svelterm has no selection feature.
- Block flow, margin collapse, display:contents, UA display defaults —
  svelterm already has these (sumi ported them *from* svelterm).

## Slices

1. **IFC core (text runs)** — `src/layout/inline.ts` (item gathering +
   tokenizer) and `src/layout/inline-break.ts` (line flow), invoked from
   `layoutBlockFlow` for runs of consecutive inline-level children;
   fragments + union boxes; fragment painting. RED:
   `<p>a <strong>bold text</strong> c</p>` wraps across the strong
   boundary browser-style, continuation lines at x=0, whitespace
   collapses, per-fragment styling.
2. **Inline-block atoms** — atomic placement on lines, top alignment.
3. **IFC text-align** — per-line shift at layout; paint skips alignment
   for fragment text (fixes the multi-line first-line-width bug).
4. **Fragment hit-testing** — hit.ts fragment checks; click/hover on a
   wrapped inline element.
5. **Sweep** — churned tests/snapshots fixed, docs
   (`docs/layout.md`, reference if needed), CHANGELOG, version bump
   (breaking layout change → 0.28.0).

Each slice: red → green → refactor → commit.
