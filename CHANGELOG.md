# Changelog

## 0.1.0

Initial release — name reservation and early preview.

**Requires** the unmerged [`svelte-custom-renderer`](https://github.com/paoloricciuti/svelte/tree/svelte-custom-renderer) branch of Svelte 5.

### Features

- **CSS engine** — selectors, specificity, cascade, inheritance, scoped styles, `var()`, `calc()`, `@media`, `@keyframes`, `:focus`, `:hover`
- **Flexbox layout** — `flex-direction`, `justify-content`, `align-items`, `flex-grow`, `flex-shrink`, `flex-basis`, `gap`, `flex-wrap`, `order`
- **Terminal rendering** — ANSI colors (16, 256, truecolor), box-drawing borders (`single`, `double`, `rounded`, `heavy`), text styles, differential output
- **Incremental updates** — mutations classified as paint-only, style-resolve, layout-subtree, or layout-bubble to avoid full recomputation
- **Input handling** — keyboard events, mouse (click, scroll, motion), focus management with Tab/Shift+Tab, bracketed paste
- **Text input** — `<input>` and `<textarea>` with readline-like editing
- **Color scheme detection** — automatic `prefers-color-scheme` via OSC 11 terminal query
- **Debug protocol** — WebSocket-based CDP-inspired server with Console domain
- **Dual-target components** — same `.svelte` component renders in terminal and browser via `@media (display-mode: terminal/screen)`
