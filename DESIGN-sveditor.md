# DESIGN — multiline textarea + sveditor demo

**COMPLETE — shipped as 0.32.0 (2026-07-07), all four slices.**

The sveditor demo (PLAN.md wishlist) drives the missing half of text
editing: `<textarea>` today shares the TextBuffer keymap but has no
multiline semantics — Enter is swallowed by the global click dispatch,
ArrowUp/Down fall through, newlines collapse in display, and no cursor
or selection paints. Editor scope per Tom (2026-07-07): **plain text
only** — no syntax highlighting.

## Core: multiline editing (mirrors sumi runtime/edit/multiline.go)

- `TextBuffer.multiline` flag, set from the element by
  `syncEditConstraints` (`tag === 'textarea'`), like sumi's
  `Constraints.Multiline`.
- `lineCol()` → `{ row, col }` in code units; `cursorUp()`/
  `cursorDown()` move a line keeping the column where the target line
  allows (clamp, not sticky), staying put at the edges — sumi's
  semantics exactly.
- Keymap when multiline: Enter inserts `\n` (consumed-but-inert under
  readOnly, as in sumi); ArrowUp/Down are movement keys — so
  Shift+Up/Down extends the selection for free. Single-line buffers
  keep today's fall-through (app keydown, then scroll default action).
- `mount()`: Enter no longer click-dispatches when the focused element
  is a textarea — it flows to the buffer. Buffer initialisation falls
  back to the element's text content (`<textarea>{text}</textarea>`
  has no `value` attribute).

## Core: textarea presentation

Rendering reuses the platform rather than a bespoke painter: a UA rule
`textarea { display: block; white-space: pre; overflow: hidden }` lets
the synced text child render one line box per newline (0.28.0 pre
path) and the standard overflow machinery clip and scroll it. What the
paint pass adds for a focused textarea:

- **Scroll follows the cursor**: before children paint, clamp
  `scrollTop`/`scrollLeft` so the buffer's `lineCol()` stays inside the
  content box (the vertical analog of paintInput's scrollLeft).
- **Hardware cursor**: publish `cache.cursorScreen` at the cursor cell
  (`stringWidth` of the line prefix for wide glyphs), so the terminal
  bar cursor appears exactly as in inputs.
- **Selection paint**: after children, invert the visible cells covered
  by `selectionRange()` across rows (offset→row/col mapping from the
  line starts).

Mouse caret/click-selection in textarea stays out of scope for this
arc (field-caret is input-only); the wheel already scrolls it via the
overflow machinery.

## Demo: sveditor

`npm run demo:sveditor` — opens `SVELTERM_EDIT_FILE` (or argv[2],
falling back to its own source), a full-frame `<textarea>` plus a
status bar: filename, a modified marker, `line:col` (derived in the
demo from the input event's `{ value, cursor }`), and a hint line.
`Ctrl+S` writes the buffer back to disk and flashes "saved" (raw mode
disables XOFF flow control, so 0x13 arrives as a key). The whole
0.29.0 keymap — kills, yank, undo, word ops, shift-selection — works
in the buffer already.

## Slices (one commit each)

1. Core multiline editing (buffer + keymap + mount Enter routing),
   RED against sumi's multiline_test.go cases.
2. Core textarea presentation (UA style, cursor, scroll-follow,
   selection paint) with paint-level unit tests.
3. sveditor demo + E2E scenario (type/newline/navigate, status bar,
   Ctrl+S saves to disk, undo).
4. Docs + changelog + 0.32.0.
