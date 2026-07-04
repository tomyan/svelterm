# svelterm

Svelte 5 components rendered to the terminal with real CSS.

Write standard Svelte components with `<style>` blocks. They render in the terminal with ANSI escape sequences — flexbox layout, scoped styles, CSS variables, pseudo-classes, all on a cell grid.

**Try it:** live playground and docs at [svelterm.dev](https://svelterm.dev), or pipe a demo straight into a real terminal:

```bash
curl -fsSL https://svelterm.dev/run/counter.mjs | node --input-type=module -
```

svelterm is largely LLM-written — designed and directed by a human, with most of the code produced in pair-programming sessions with Claude, test-driven and reviewed as it landed. If that's not your thing, there are plenty of artisanal, hand-typed frameworks out there.

> **Early release.** Svelterm requires an unmerged Svelte branch (`svelte-custom-renderer` by [@paoloricciuti](https://github.com/paoloricciuti)) that adds the custom renderer API. It is not usable with mainline Svelte yet.

## Example

```svelte
<script>
    let count = $state(0)
</script>

<style>
    .counter {
        display: flex;
        flex-direction: column;
        border: rounded;
        border-color: cyan;
        padding: 1cell;
        gap: 1cell;
    }

    .value {
        color: yellow;
        font-weight: bold;
    }

    button:focus {
        color: cyan;
        font-weight: bold;
    }
</style>

<div class="counter">
    <span>Count: <span class="value">{count}</span></span>
    <button onclick={() => count++}>Increment</button>
    <button onclick={() => count--}>Decrement</button>
</div>
```

```typescript
import { run } from '@svelterm/core/app'
import { readFileSync } from 'fs'
import App from './App.svelte'

const css = readFileSync('./main.css', 'utf-8')
run(App, { css })
```

## Dual-target components

The same Svelte component can render in both terminal and browser. Terminal-specific CSS values (`border: rounded`, `1cell`, `opacity: dim`) are naturally ignored by browsers — they're invalid CSS. Browser-specific rules go in `@media (display-mode: screen)`.

```svelte
<style>
    .greeting {
        border: rounded;
        border-color: cyan;
        padding: 1cell;
    }

    @media (display-mode: screen) {
        .greeting {
            border: 2px solid #00b4d8;
            border-radius: 8px;
            padding: 1rem;
        }
    }
</style>
```

To build for each target, use separate Vite configs — one with `customRenderer: '@svelterm/core'` for terminal, one without for browser. The component source is the same.

## What's different in terminal CSS

Standard CSS works as expected. These are the terminal-specific additions:

| Feature | Terminal | Browser |
|---------|----------|---------|
| **Borders** | `single`, `double`, `rounded`, `heavy` (box-drawing characters) | Ignored (invalid values) |
| **Units** | `cell` — one monospace character position | Ignored (unknown unit) |
| **Opacity** | `dim` — terminal dim attribute | Ignored (invalid value) |
| **Colors** | ANSI names, 256-color, truecolor hex, CSS named colors | Standard CSS colors |
| **Media** | `@media (display-mode: terminal)` | `@media (display-mode: screen)` |

## Features

- **CSS engine** — selectors (attribute operators, structural/state pseudo-classes, `::before`/`::after`), specificity, cascade, inheritance, scoped styles, `var()`, `calc()`, `@media`, `@container`, `@supports`, `@keyframes`
- **Flexbox layout** — `flex-direction`, `justify-content`, `align-items`, `flex-grow`, `flex-shrink`, `gap`, `flex-wrap`
- **CSS grid** — column and row templates with `fr`/`repeat()`/`minmax()`, `grid-column`/`grid-row` placement and spans, `grid-template-areas` with named `grid-area`
- **CSS tables** — `display: table*` including `inline-table`, sections and captions, `colspan`/`rowspan`, column sizing, `vertical-align`, `border-collapse` with shared box-drawing grid lines, anonymous boxes
- **Animations & transitions** — `@keyframes` with RGB colour interpolation and cell-stepped length animation, `transition` on style changes
- **Terminal rendering** — ANSI colors (16, 256, truecolor), borders, text styles, differential output
- **Input** — keyboard events, mouse click and scroll, focus management with Tab/Shift+Tab, `:focus` and `:hover` pseudo-classes
- **Form controls** — `<input>`/`<textarea>` editing, checkboxes and radios, cycling `<select>`, `<progress>`/`<meter>` bars, `<details>`/`<summary>`
- **Incremental updates** — mutation tracking classifies changes as paint-only, style-resolve, or layout to avoid full recomputation
- **Color scheme** — automatic `prefers-color-scheme` detection via terminal queries

### Browser compatibility

Any HTML/CSS feature with a sensible cell-grid meaning works as a browser
author expects; pixel-derived features are dropped silently and targeted
per mode with `@media (display-mode: terminal | browser)`. The manual
lives in [`docs/`](docs/) — [getting started](docs/getting-started.md),
[terminal CSS](docs/terminal-css.md), [layout](docs/layout.md),
[selectors](docs/selectors.md), [elements & input](docs/elements.md),
[motion](docs/motion.md), [compatibility](docs/compatibility.md),
[terminal support](docs/terminals.md),
[inline mode](docs/inline-mode.md) — with
the one-page support matrix in [`docs/reference.md`](docs/reference.md)
and the design rationale in
[`DESIGN-browser-compat.md`](DESIGN-browser-compat.md).

## Prerequisites

Svelterm requires the experimental custom renderer API from the [`svelte-custom-renderer`](https://github.com/sveltejs/svelte/pull/18042) branch by [@paoloricciuti](https://github.com/paoloricciuti). Until [sveltejs/svelte#18505](https://github.com/sveltejs/svelte/pull/18505) lands (it exposes `mount`/`unmount` from `svelte/renderer`, which svelterm needs on Node), clone the branch from the svelterm fork, which tracks upstream plus that fix:

```bash
# Clone the branch
git clone -b svelte-custom-renderer https://github.com/tomyan/svelte.git svelte-fork
cd svelte-fork
pnpm install
pnpm -C packages/svelte build
```

Then reference it in your project's `package.json`:

```json
{
    "peerDependencies": {
        "svelte": "file:../svelte-fork/packages/svelte"
    }
}
```

## Setup

Scaffold a project with the CLI (the Svelte fork above must be a sibling
directory, or adjust the `svelte` path in the generated `package.json`):

```bash
npx @svelterm/core init my-app
cd my-app && npm install
npm run dev    # vite dev server (terminal 1)
npm run app    # the app, hot-reloading, in this terminal (terminal 2)
npm run build  # → dist/app.mjs — self-contained, runs with plain node
```

`console.log` output from the app streams to the vite terminal, like a
browser console. See [docs/getting-started.md](docs/getting-started.md)
for manual setup and dual-target configuration.

## API

### `run(component, options?)`

Start an interactive terminal application.

```typescript
import { run } from '@svelterm/core/app'

const stop = run(App, {
    css,                    // Extracted CSS string
    fullscreen: true,       // Use alternate screen buffer (default: true)
    mouse: true,            // Enable mouse input (default: true)
    props: { name: 'world' },
})

// Call stop() to shut down and restore terminal
```

Returns a function that stops the application, unmounts the component, and restores the terminal.

## License

MIT
