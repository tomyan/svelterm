# CSS

Svelterm uses real CSS — the same scoped `<style>` blocks that Svelte compiles for the browser. The CSS engine parses selectors, computes specificity, cascades rules, resolves variables, and evaluates media queries. The difference is how property values are interpreted: `border: rounded` draws box-drawing characters, `1cell` maps to terminal cells, colors map to ANSI codes or truecolor sequences.

## Terminal-specific values

These values work in the terminal and are ignored by browsers:

### Border styles

```css
.box {
    border: single;   /* ┌──┐ │  │ └──┘ */
    border: double;   /* ╔══╗ ║  ║ ╚══╝ */
    border: rounded;  /* ╭──╮ │  │ ╰──╯ */
    border: heavy;    /* ┏━━┓ ┃  ┃ ┗━━┛ */
}
```

Browsers don't recognise these values and fall back to `border: none`.

### The `cell` unit

Terminal cells are the fundamental unit — one character position. Use `cell` anywhere you'd use `px` or `rem`:

```css
.panel {
    width: 30cell;
    padding: 1cell 2cell;
    gap: 1cell;
}
```

Browsers ignore `cell` values since it's not a recognised CSS unit. Use `@media` blocks for browser-specific sizing:

```css
.panel { padding: 1cell; }

@media (display-mode: screen) {
    .panel { padding: 0.5rem; }
}
```

### Opacity

`opacity: dim` renders text with the terminal dim attribute (SGR code 2). Values less than 1 also trigger dim:

```css
.muted { opacity: dim; }
.faint { opacity: 0.5; }  /* also dim */
```

## Selectors

Full CSS selector support:

| Selector | Example | Description |
|---|---|---|
| Tag | `div` | Element type |
| Class | `.active` | Class attribute |
| ID | `#main` | ID attribute |
| Universal | `*` | Any element |
| Attribute | `[href]`, `[data-type="x"]` | Attribute presence/value |
| Descendant | `.app span` | Any descendant |
| Child | `.app > div` | Direct child |
| Adjacent sibling | `h1 + p` | Immediately after |
| General sibling | `h1 ~ p` | Any sibling after |
| `:first-child` | `li:first-child` | First child of parent |
| `:last-child` | `li:last-child` | Last child of parent |
| `:not()` | `div:not(.hidden)` | Negation |
| `:focus` | `button:focus` | Has keyboard focus |
| `:hover` | `.item:hover` | Mouse is over element |
| `:root` | `:root` | Root element |

Svelte's scoped class hashes (e.g. `.svelte-abc123`) work naturally — they're just class selectors.

## Colors

### ANSI named colors

```css
.error { color: red; }
.info { color: cyan; }
.warning { color: yellow; background-color: black; }
```

The 8 base ANSI colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`.

### Truecolor (24-bit)

```css
.brand { color: #ff6b6b; }
.accent { color: rgb(81, 207, 102); }
.highlight { color: hsl(210, 100%, 60%); }
```

Hex (3 and 6 digit), `rgb()`, `rgba()`, `hsl()`, `hsla()` all produce 24-bit truecolor output.

### CSS named colors

All 148 CSS Level 4 named colors are supported: `coral`, `teal`, `rebeccapurple`, `goldenrod`, etc.

## CSS Variables

```css
:root {
    --primary: cyan;
    --accent: yellow;
    --muted: gray;
}

.title { color: var(--primary); }
.value { color: var(--accent); }
.hint { color: var(--muted, gray); }  /* with fallback */
```

Variables cascade through the tree. Changing a class on an ancestor updates all descendants that reference its variables.

## Media queries

```css
/* Terminal-only rules */
@media (display-mode: terminal) {
    .panel { border: rounded; padding: 1cell; }
}

/* Browser-only rules */
@media (display-mode: screen) {
    .panel { border-radius: 8px; padding: 0.5rem; }
}

/* Light/dark adaptation — detected automatically via OSC 11 */
@media (prefers-color-scheme: dark) {
    :root { --bg: black; --fg: white; }
}
@media (prefers-color-scheme: light) {
    :root { --bg: #eeeeee; --fg: #111111; }
}

/* Responsive to terminal size */
@media (min-width: 80) {
    .sidebar { display: flex; }
}
```

## Container queries

```css
@container (min-width: 40) {
    .card { flex-direction: row; }
}
```

Container queries evaluate after the first layout pass, then re-resolve styles for matching containers.

## Math functions

```css
.panel {
    width: calc(100% - 4cell);
    height: min(20cell, 50%);
    padding: clamp(1cell, 5%, 3cell);
}
```

`calc()`, `min()`, `max()`, `clamp()` work in sizing properties.

## Specificity and cascade

Standard CSS specificity rules apply:

1. ID selectors (`#main`) — highest
2. Class, attribute, pseudo-class (`.active`, `[href]`, `:focus`) — medium
3. Tag selectors (`div`, `span`) — lowest

At equal specificity, later rules win. `inherit`, `initial`, and `unset` keywords are supported.

## What's not supported

Properties that don't map to terminal capabilities:

- `font-family`, `font-size` — terminal is monospace, fixed size
- `border-radius` — use `border: rounded` instead
- `box-shadow`, `transform`, `transition` — no sub-cell rendering
- `float` — not implemented
- `!important` — not implemented
- `opacity` with blending — terminal cells are opaque; opacity maps to dim
