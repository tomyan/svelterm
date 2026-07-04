# Animations and transitions

CSS motion works on the grid with one honest constraint: a cell either
has a glyph and colours or it doesn't. Colours interpolate smoothly;
geometry steps cell by cell; everything else switches discretely.

## Animations

[`@keyframes`](https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes)
with `from`/`to` or percentage stops, driven by the `animation` shorthand
or `animation-name` / `animation-duration` / `animation-iteration-count`
(including `infinite`):

```css
@keyframes pulse {
    0%  { color: #ef4444; }
    50% { color: #7f1d1d; }
}
.recording { animation: pulse 1s infinite; }
```

## What interpolates

- **Colours** (`color`, `background`) mix in RGB at ~30fps between the
  surrounding stops. ANSI palette names interpolate through nominal
  values and stay exact at the endpoints.
- **Single cell/ch lengths** (`width`, `height`, `padding-*`, `margin-*`,
  insets, `gap`) interpolate and round to whole cells — a 10-cell slide
  is ten visible steps, so give movement enough distance to read.
- **Everything else** supported by the style system (`display`,
  `font-weight`, `border-*`, `visibility`, …) applies discretely,
  switching at the midpoint of the segment — the CSS rule for
  non-interpolable values.

Layout-affecting animations re-flow every frame; colour-only animations
just repaint.

## Transitions

[`transition`](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transitions)
runs when a tracked property's target changes — a class toggles, an
inline style updates, a `:checked` rule starts applying:

```css
.preview { transition: background-color 400ms; }
.tab     { transition: color 150ms, padding-left 150ms; }
```

`transition-property` takes a list or `all`; `transition-duration` takes
`ms`/`s`. The same interpolation rules as animations apply. The initial
style never transitions.

## Deviations from browsers

- **No easing curves** — interpolation is linear; easing keywords parse
  and are ignored.
- One duration applies to all listed transition properties (the first
  duration wins).
- An interrupted transition restarts from its previous target value, not
  the current blended value.
- `opacity` can't fade (dim is binary) — animate colour toward the
  background instead.
- Keyframe declarations do **not** resolve `var()` or `light-dark()` —
  use literal colours inside `@keyframes` that read on both schemes.

## Reduced motion

Media queries work, so honour user preference the standard way:

```css
@media (prefers-reduced-motion: reduce) {
    .recording { animation: none; }
}
```
