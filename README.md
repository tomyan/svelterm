# svelterm

Svelte 5 components rendered to the terminal with real CSS.

Write standard Svelte components with `<style>` blocks. They render in the terminal with ANSI escape sequences — flexbox layout, scoped styles, CSS variables, pseudo-classes, all on a cell grid.

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

- **CSS engine** — selectors, specificity, cascade, inheritance, scoped styles, `var()`, `calc()`, `@media`, `@keyframes`
- **Flexbox layout** — `flex-direction`, `justify-content`, `align-items`, `flex-grow`, `flex-shrink`, `gap`, `flex-wrap`
- **Terminal rendering** — ANSI colors (16, 256, truecolor), borders, text styles, differential output
- **Input** — keyboard events, mouse click and scroll, focus management with Tab/Shift+Tab, `:focus` and `:hover` pseudo-classes
- **Text input** — `<input>` and `<textarea>` with readline-like editing
- **Incremental updates** — mutation tracking classifies changes as paint-only, style-resolve, or layout to avoid full recomputation
- **Color scheme** — automatic `prefers-color-scheme` detection via terminal queries

## Prerequisites

Svelterm requires the experimental custom renderer API, available on the [`svelte-custom-renderer`](https://github.com/paoloricciuti/svelte/tree/svelte-custom-renderer) branch:

```bash
# Clone the branch
git clone -b svelte-custom-renderer https://github.com/paoloricciuti/svelte.git svelte-fork
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

Configure the Svelte compiler to use svelterm as the custom renderer:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
    plugins: [
        svelte({
            compilerOptions: {
                experimental: {
                    customRenderer: '@svelterm/core',
                },
                css: 'external',
            },
        }),
    ],
    build: {
        target: 'node22',
        rollupOptions: {
            external: ['svelte', 'svelte/renderer', 'svelte/internal',
                        'svelte/internal/client', 'ws', 'http', 'crypto'],
        },
    },
})
```

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
