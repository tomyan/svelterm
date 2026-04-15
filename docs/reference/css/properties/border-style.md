---
name: border-style
category: css/properties
summary: Controls the visual appearance of an element's border.
related:
  - css/properties/border-corner
  - css/properties/border-color
  - css/properties/padding
  - css/properties/margin
---

# `border-style`

Selects which characters render the four edges of an element's border. Two families: **box-drawing** (thin strokes through the cell centre) and **block-character** (strips on a chosen edge of each cell). Block-character styles compose cleanly with `background-color`; box-drawing styles do not.

## Values

| Value | Family | Composes with `background-color` |
|-------|--------|----------------------------------|
| `none` | — | n/a |
| `single` | box-drawing | no |
| `double` | box-drawing | no |
| `rounded` | box-drawing | no |
| `heavy` | box-drawing | no |
| `eighth-cell-inner` | block-character | yes |
| `eighth-cell-outer` | block-character | yes |
| `half-cell-inner` | block-character | yes |
| `half-cell-outer` | block-character | yes |
| `full-cell` | block-character | n/a (no bg shows) |

The `*-cell-inner` variants paint a strip on the **inner** edge of each border cell (facing the content). The `*-cell-outer` variants paint on the **outer** edge.

## Box-drawing styles

`single`, `double`, `rounded`, `heavy` use Unicode box-drawing characters (`┌─┐│└┘`, `╔═╗║╚╝`, `╭─╮│╰╯`, `┏━┓┃┗┛`). The stroke runs through the centre of each cell and the surrounding cell area takes the cell's `background-color`.

```
┌──────────────┐
│ hello        │
└──────────────┘
```

When the element has a coloured `background-color`, the bg fills the gap around the stroke — the border looks like it's floating in a coloured frame rather than at the box edge. For coloured boxes with a visible border, prefer `*-cell-inner` instead.

## Block-character styles

### `eighth-cell-inner`

1/8-cell stroke on the inner edge of each border cell. Faces the content. Corner cells are blank.

```
 ▁▁▁▁▁▁▁▁▁▁▁▁
▕            ▏
▕            ▏
 ▔▔▔▔▔▔▔▔▔▔▔▔
```

Combined with `background-color`, the 7/8 of each border cell that isn't the stroke takes the bg colour — the fill extends right up to the stroke.

### `eighth-cell-outer`

Same 1/8 stroke, but on the outer edge of each border cell. Faces away from the content.

### `half-cell-inner` / `half-cell-outer`

Same model with 1/2-cell strokes (`▄▀▐▌`). Thicker, more visible.

### `full-cell`

Each border cell is painted entirely with `█` in the border colour. The thickest visible option; no portion of the border cell shows the cell `background-color`.

## Corner behaviour

Block-character styles have no glyph that combines two perpendicular strokes in one cell. By default corner cells are left blank (soft-rounded look). Use [`border-corner`](border-corner.md) to make one axis own the corners instead.

| `border-corner` | Effect on `*-cell-*` styles |
|-----------------|------------------------------|
| `none` (default) | Corners blank |
| `h` | Top/bottom strokes extend through corners; sides stop one cell short |
| `v` | Left/right strokes extend through corners; top/bottom stop one cell short |

Box-drawing styles have proper corner glyphs and ignore `border-corner`.

## Padding/margin collapse

`*-cell-*` borders have a side-asymmetric "natural gap" — the unused 7/8 (or 1/2) of each border cell. To avoid this gap visually doubling with explicit `padding`/`margin`, the unused side **collapses into** the corresponding box-model value:

- The border cell occupies 1 cell of layout regardless of facing direction.
- The "spacer" side (opposite the stroke) absorbs **1 cell** of explicit padding or margin on that side.
- `*-inner` borders absorb `margin`. `*-outer` borders absorb `padding`.

### `eighth-cell-outer` with varying `padding`

| CSS | Visual outcome |
|-----|----------------|
| `padding: 0` | Content sits right behind the stroke (no gap) |
| `padding: 1cell` | The 1-cell border cell *is* the padding. No extra cells beyond it. |
| `padding: 2cell` | 1 extra cell of padding beyond the border cell. |

### `eighth-cell-inner` with varying `margin`

| CSS | Visual outcome |
|-----|----------------|
| `margin: 0` | Border cell sits right against the next box (no outer gap) |
| `margin: 1cell` | The 1-cell border cell *is* the margin. No extra cells beyond it. |
| `margin: 2cell` | 1 extra cell of margin beyond the border cell. |

In short: explicit `padding`/`margin` specifies the *total* visual space on that side, with the border cell counting toward it.

## Examples

### Coloured box with thin border

```css
.box {
    background-color: #b00;
    border-color: #0f0;
    border-style: eighth-cell-inner;
    padding: 0;
}
```

```
 ▁▁▁▁▁▁▁▁▁▁▁▁
▕            ▏
▕            ▏
 ▔▔▔▔▔▔▔▔▔▔▔▔
```

### Decorative thin border (no fill)

```css
.box {
    border-style: rounded;
    border-color: #888;
}
```

```
╭──────────────╮
│              │
│              │
╰──────────────╯
```

### Block frame with corner ownership

```css
.box {
    border-style: half-cell-inner;
    border-color: #fff;
    border-corner: h;
}
```

Top and bottom rows extend through the corners; sides stop one cell short.

## Notes

- The `*-cell-*` styles use Unicode block characters (U+2580–U+259F). These are widely supported in modern terminal fonts.
- `full-cell` is essentially a thick painted frame — useful for highlighting but ignores the bg colour entirely.
- Per-side border styles are supported (e.g. `border-top: eighth-cell-inner; border-bottom: half-cell-inner`). Corners follow the `border-corner` setting regardless of mixed styles.

## See also

- [`border-corner`](border-corner.md) — corner ownership for block-character borders
- [`border-color`](border-color.md) — colour of the border stroke
- [`padding`](padding.md), [`margin`](margin.md) — interact with the collapse rule above
