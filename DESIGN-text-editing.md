# DESIGN — text-editing parity in input/textarea

**COMPLETE — shipped as 0.29.0 (2026-07-07), all five slices.**

Arc 1 of PLAN-NEXT.md. Decision (Tom, 2026-07-06): mirror sumi's text
editing wholesale — same keymap and semantics, no redesign. Where a
chord conflicts with an existing svelterm binding, resolve in sumi's
favour where possible.

## Source of truth

PLAN-NEXT pointed at `~/projects/sumi/runtime/layout/cursor_editable.go`
and `directwrite.go`; those are presentation-layer files. Sumi's actual
editing model lives in **`~/projects/sumi/runtime/edit/`**:

- `edit.go` — `State` (rune-offset cursor), undo/redo snapshot stacks,
  kill ring with yank cycling, word ops, transpose, word transforms,
  command history.
- `keymap.go` — the bound chords (readline style).
- `multiline.go` — line-aware cursor up/down for multiline values.
- `constraints.go` — maxlength/readonly gating (svelterm already
  mirrors this: `src/input/edit-constraints.ts`, 0.27.0).

Svelterm's counterpart is `src/components/text-buffer.ts` (`TextBuffer`),
driven from the key handler in `src/index.ts`. Cursor is a UTF-16
code-unit offset moved along grapheme boundaries (`layout/unicode.ts`)
— richer than sumi's rune offsets; word scans land next to whitespace
or at the ends, which are always grapheme boundaries, so plain
code-unit scanning is safe.

## Keymap

Bound in sumi's keymap.go (mirror exactly):

| Chord | Op | Svelterm status |
|---|---|---|
| Ctrl+A / Home | home | shipped |
| Ctrl+E / End | end | shipped |
| Ctrl+B / ← | left | Ctrl+B new |
| Ctrl+F / → | right | Ctrl+F new |
| Ctrl+H / Backspace | backspace | Ctrl+H new |
| Ctrl+D / Delete | delete | Ctrl+D new (see conflicts) |
| Ctrl+K | kill to end | shipped as clearToEnd; gains kill-ring push |
| Ctrl+U | kill to start | shipped as clearToStart; gains kill-ring push |
| Ctrl+W | kill word back | new |
| Ctrl+Y | yank | new |
| Ctrl+T | transpose chars | new |

In sumi's model with chords documented in its op comments but not yet
bound in its keymap (we bind them; sumi will when it wires Alt):

| Chord | Op |
|---|---|
| Alt+D | kill word forward |
| Alt+Y | yank-pop (cycle kill ring, only straight after yank) |
| Ctrl+_ | undo |

Word navigation has no chord in sumi yet; we use the readline
conventions its code follows everywhere else, plus the arrow variants
terminals commonly emit:

| Chord | Op |
|---|---|
| Alt+B, Ctrl+←, Alt+← | word left |
| Alt+F, Ctrl+→, Alt+→ | word right |
| Alt+Backspace | kill word back (alias of Ctrl+W) |

Word transforms (Alt+U/L/C) and command history (↑/↓) are in sumi's
model but out of scope for this arc — PLAN-NEXT doesn't list them;
promote later if wanted.

## Chord conflicts (resolved per plan: sumi's favour where possible)

- **Ctrl+C** — svelterm global exit, handled before text input. Sumi
  doesn't bind it. Stays.
- **Ctrl+D** — svelterm exits only when `exitOn` includes `'ctrl+d'`
  (handled upstream); otherwise the chord reaches the buffer → bind
  delete-char as sumi does.
- **Ctrl+Z** — svelterm suspend, handled upstream. Undo binds Ctrl+_
  (sumi's documented primary; its comment lists "Ctrl+_ or Ctrl+Z").
- **Redo** — unbound in sumi (readline has no redo chord; Ctrl+Y is
  yank). Mirror: expose `redo()` programmatically, bind nothing.

## Semantics mirrored from sumi

- **Word boundary**: whitespace-delimited. Left: skip spaces back, then
  non-spaces. Right: skip spaces forward, then non-spaces (cursor ends
  *after* the word). `isSpace` = Unicode whitespace (`/\s/`).
- **Kill ring**: every kill (Ctrl+K/U/W, Alt+D, Alt+Backspace) pushes;
  yank inserts the current ring entry; Alt+Y immediately after a yank
  replaces it with the previous entry and cycles. Any other op clears
  the "last was yank" latch.
- **Undo**: snapshot (value+cursor) pushed before every mutation; undo
  pops onto a redo stack; any new mutation clears redo.
- **readOnly** blocks mutation, movement stays live (existing TextBuffer
  rule; matches constraints.go).

## Beyond sumi (from PLAN-NEXT scope): field selection — slice 2

Sumi's edit package has no selection, so this slice follows standard
browser input semantics, with region chords from the same readline/
emacs family the rest of the keymap mirrors.

**Model.** `TextBuffer` gains `selectionAnchor: number | null`; the
selection is `[min(anchor, cursor), max(anchor, cursor))` in code
units, empty when the anchor is null or equals the cursor.

**Keyboard.** Shift+←/→/Home/End extends (anchor set to the cursor
position before the first extending move); Shift+Ctrl/Alt+arrows
extends by word. Any unshifted movement collapses the selection.
Typing and paste replace an active selection; Backspace/Delete and the
word deletes remove the selection only. Alt+B/F never extend (no
shifted form in terminals).

**Cut/copy chords** (Ctrl+C is svelterm exit, Ctrl+X unused — emacs
region chords keep us in the readline family):

| Chord | Op |
|---|---|
| Ctrl+W | with selection: cut it; without: kill word back (emacs/readline duality) |
| Alt+W | copy selection (emacs kill-ring-save); selection stays |

**Clipboard.** TextBuffer stays IO-free: cut/copy park the text and the
caller drains it (`drainClipboardText()`) into the existing
`copyToClipboard` (OSC 52 + platform tool). Slice 3 additionally pushes
cuts onto the kill ring.

**Mouse.** A left press that hits an editable input places the caret
(column → offset via padding/border inset + scrollLeft); double-click
selects the clicked word in the field and copies it (matching the
global selection's copy-on-select). Presses landing on editable inputs
suppress the global screen-space selection so the two highlights never
fight; everywhere else the global controller is untouched.

**Paint.** `paintInput` inverts the visible selected span while the
element is focused.

**v1 limits.** Textarea gets the keyboard selection model (shared
TextBuffer) but no painted highlight or mouse caret — its value renders
as a plain text child with no dedicated paint path yet. readOnly blocks
cut (copy still works), as it blocks all mutation.

## Slices (carpaccio, one commit each)

1. **Word ops** — `wordLeft`/`wordRight`/`deleteWordLeft`/
   `deleteWordRight` on TextBuffer with sumi's boundary semantics; bind
   Alt+B/F, Ctrl/Alt+arrows, Ctrl+W, Alt+D, Alt+Backspace. Parser gains
   legacy Alt chords (ESC+printable, ESC+DEL → `meta: true`, mirroring
   sumi `input/event.go`). Deletes don't push to the ring yet (slice 3
   upgrades them).
2. **Shift+movement selection** + double-click word select + cut/copy
   via existing clipboard plumbing.
3. **Kill ring** — ring + yank/yank-pop; upgrade all kills to push;
   remaining sumi chord parity (Ctrl+B/F/H/D aliases, Ctrl+T transpose).
4. **Undo/redo stacks** — Ctrl+_ undo (parser: 0x1f), redo programmatic.
5. **Docs + changelog + 0.29.0.**
