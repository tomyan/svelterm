---
name: border-corner
category: css/properties
summary: Controls which axis owns the corner cells of a block-character border.
related:
  - css/properties/border-style
---

# `border-corner`

Block-character border styles (`eighth-cell-*`, `half-cell-*`) have no Unicode glyph that combines two perpendicular strokes in a single cell. `border-corner` selects which axis "owns" the corner cells.

## Values

| Value | Effect |
|-------|--------|
| `none` | Default. Corner cells blank — produces a soft-rounded look. |
| `h` | Top/bottom strokes extend through corner cells. Side strokes stop one cell short. |
| `v` | Left/right strokes extend through corner cells. Top/bottom stop one cell short. |

Only meaningful for [`border-style`](border-style.md) values in the `*-cell-*` family. Box-drawing styles (`single`, `double`, `rounded`, `heavy`) have proper corner glyphs and ignore this property.

## Examples

### `border-corner: none` (default)

```css
.box {
    border-style: eighth-cell-inner;
}
```

```
 ▁▁▁▁▁▁▁▁▁▁▁▁
▕            ▏
 ▔▔▔▔▔▔▔▔▔▔▔▔
```

Corners blank; the box reads as soft-rounded.

### `border-corner: h`

```css
.box {
    border-style: eighth-cell-inner;
    border-corner: h;
}
```

```
▁▁▁▁▁▁▁▁▁▁▁▁▁▁
              
 ▔▔▔▔▔▔▔▔▔▔▔▔
```

Top/bottom strokes own the corners; sides indent by one.

### `border-corner: v`

```css
.box {
    border-style: eighth-cell-inner;
    border-corner: v;
}
```

```
 ▁▁▁▁▁▁▁▁▁▁▁▁
▕            ▏
▕            ▏
 ▔▔▔▔▔▔▔▔▔▔▔▔
```

Side strokes own the corners; top/bottom indent by one.

## Notes

- `border-corner` is per-element; mixing per-side `border-style` values does not change which axis owns the corner.

## See also

- [`border-style`](border-style.md)
