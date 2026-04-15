# Border Styles Design

Block-character border styles for terminal-friendly borders that compose with `background-color`.

## Motivation

Existing `border-style` values (`single`, `double`, `rounded`, `heavy`) use box-drawing characters (`┌─┐│└┘` etc.). These render as a thin stroke through the centre of each cell. The rest of each border cell takes the cell's background, which produces a visual artefact when the element has a coloured `background-color`: the bg fill shows in the gap around the box-drawing stroke, making the border look like it's floating in a coloured frame rather than at the edge of the box.

To get a clean coloured fill with a visible border, we need border characters that fill more of their cell — but ideally still readable as "border", not "fill". Block characters (`▁▔▕▏▄▀▐▌█`) give us this: they paint a strip on one edge of the cell and leave the rest as cell bg, which we can colour independently.

## Visual Model

Existing styles use box-drawing characters:

```
┌──────┐
│      │
│      │
└──────┘
```

Stroke runs through cell centre. Surrounding cell area fills with the cell bg.

New `*-cell-inner` styles use block-character strips on the inside edge:

```
 ▁▁▁▁▁▁
▕      ▏
▕      ▏
 ▔▔▔▔▔▔
```

- Top edge cells: `▁` (lower 1/8) — stroke at bottom of cell, facing inward toward content
- Bottom: `▔` (upper 1/8) — stroke at top of cell, facing inward
- Left: `▕` (right 1/8) — stroke at right of cell, facing inward
- Right: `▏` (left 1/8) — stroke at left of cell, facing inward
- Corners (top-left, top-right, bottom-left, bottom-right cells): blank

The 7/8 of each border cell that isn't the stroke takes the cell bg. With `background-color: red` on the element, the border cell's bg is red — so visually the red fill extends right up to the stroke and the corners read as soft-rounded.

`*-cell-outer` mirrors this: strokes at the *outer* edge of the border cell, faces outward. The 7/8 inner portion of the border cell takes the cell bg.

`half-cell-*` uses half-blocks (`▄▀▐▌`) instead of eighth-blocks. Same facing rules, just thicker.

`full-cell` fills border cells entirely with `█` (no facing distinction — the whole cell is stroke).

## CSS Properties

### `border-style`

| Value | Render | Composes with `background-color`? |
|-------|--------|------------------------------------|
| `none` | no border | n/a |
| `single` | box-drawing single line | no — bg shows through stroke gap |
| `double` | box-drawing double line | no |
| `rounded` | box-drawing single, rounded corners | no |
| `heavy` | box-drawing heavy single | no |
| `eighth-cell-inner` | 1/8 block stroke, inner edge of border cell | **yes** |
| `eighth-cell-outer` | 1/8 block stroke, outer edge of border cell | **yes** |
| `half-cell-inner` | 1/2 block stroke, inner edge | **yes** |
| `half-cell-outer` | 1/2 block stroke, outer edge | **yes** |
| `full-cell` | full block (`█`) fills border cell | n/a — no bg shows |

The `*-cell-*` styles are the only border styles that compose cleanly with `background-color`. Use them whenever the element has a coloured fill and a visible border. Use the box-drawing styles for decorative borders without bg.

### `border-corner`

Eighth-cell and half-cell borders have no glyph that combines two perpendicular strokes in one cell. The default behaviour leaves corner cells blank (soft-rounded look). `border-corner` lets one axis "own" the corner instead:

| Value | Behaviour |
|-------|-----------|
| `none` | corner cells blank (default) |
| `h` | top/bottom strokes extend through corner cells; sides stop one cell short |
| `v` | left/right strokes extend through corner cells; top/bottom stop one cell short |

Only meaningful for `*-cell-*` border styles. Ignored for box-drawing styles (which have proper corner glyphs).

## Padding/Margin Collapse

`*-cell-inner` and `*-cell-outer` borders have a side-asymmetric "natural gap":

- **Inner-facing**: the 7/8 (or 1/2) of the border cell on the *outer* side is unused. Visually it looks like margin.
- **Outer-facing**: the 7/8 (or 1/2) on the *inner* side is unused. Visually it looks like padding.

When the author sets explicit `padding` or `margin`, the natural gap **collapses into** that value rather than adding to it. Rules:

- The border cell occupies 1 cell of layout regardless of facing.
- The "spacer" side (opposite the stroke) absorbs **1 cell** of explicit padding or margin on that side.
- Inner-facing border absorbs `margin`. Outer-facing absorbs `padding`.

### Example: `border-style: eighth-cell-outer` (stroke at outer edge, spacer faces inward → collapses with `padding`)

| Author CSS | Visual outcome |
|------------|----------------|
| `padding: 0` | Content sits right behind the stroke (no gap) |
| `padding: 1cell` | The 1-cell border cell *is* the padding. No extra cells beyond it. |
| `padding: 2cell` | 1 extra cell of padding beyond the border cell. |

### Example: `border-style: eighth-cell-inner` (stroke at inner edge, spacer faces outward → collapses with `margin`)

| Author CSS | Visual outcome |
|------------|----------------|
| `margin: 0` | Border cell sits right against next box (no gap outside) |
| `margin: 1cell` | The 1-cell border cell *is* the margin. No extra cells beyond it. |
| `margin: 2cell` | 1 extra cell of margin beyond the border cell. |

### Effect

Authors specify total visual space; the border cell counts toward it. Setting `padding: 1cell` on an outer-facing border gives the natural-looking inset gap (it's a no-op layout-wise but matches author intent). Setting `padding: 0` gives flush content. Larger values add real cells.

## Naming Rationale

- **`-cell` suffix** mirrors the existing `cell` unit (`width: 3cell`). Immediately distinguishable from browser CSS.
- **`eighth-` / `half-` / `full-`** describe the visible thickness directly (1/8, 1/2, 1/1 of a cell).
- **`-inner` / `-outer`** describes which side of the border cell the stroke sits on, matching the natural English reading.
- **`border-corner: h | v | none`** uses single-letter axes for terseness in shorthand.

Standard CSS `inset` / `outset` keywords are deliberately avoided to prevent confusion with the CSS bevel-effect values.

## Open Questions

- Should `full-cell` also support `border-corner`? (Probably no — full block fills entirely, corners are unambiguous.)
- Asymmetric thicknesses (e.g. `border-top: half-cell-inner; border-bottom: eighth-cell-inner`) — supported in principle by CSS sub-properties; need to verify the renderer handles per-side styles correctly.
- Per-side `border-corner` (e.g. only the top-left owns its corner)? Probably not worth the complexity initially.
