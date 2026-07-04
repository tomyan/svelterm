# Getting started

svelterm runs Svelte components in a terminal. You write ordinary Svelte —
markup, scoped `<style>`, runes, event handlers — and the renderer lays it
out on a character-cell grid instead of a browser DOM.

## Prerequisites

svelterm builds on Svelte's experimental custom renderer API, currently on
the [`svelte-custom-renderer`](https://github.com/paoloricciuti/svelte/tree/svelte-custom-renderer)
branch:

```bash
git clone -b svelte-custom-renderer https://github.com/paoloricciuti/svelte.git svelte-fork
cd svelte-fork
pnpm install
pnpm -C packages/svelte build
```

Reference the build from your project:

```json
{
    "peerDependencies": {
        "svelte": "file:../svelte-fork/packages/svelte"
    }
}
```

## Build setup

Point the Svelte compiler at svelterm's renderer and keep CSS external —
the terminal engine consumes the extracted stylesheet:

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
    plugins: [
        svelte({
            compilerOptions: {
                experimental: { customRenderer: '@svelterm/core' },
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

## A first component

```svelte
<script>
    let count = $state(0)
</script>

<div class="counter">
    <button onclick={() => count++}>count is {count}</button>
</div>

<style>
    .counter {
        padding: 1cell 2cell;
    }
    button {
        border: single;
        border-color: cyan;
        padding: 0 1cell;
    }
    button:focus {
        border-color: yellow;
    }
</style>
```

Run it:

```typescript
import { run } from '@svelterm/core/app'
import App from './App.svelte'
import css from './App.css?raw' // the extracted stylesheet

const handle = run(App, { css })
// handle.cleanup() restores the terminal
```

Press `Tab` to focus the button, `Enter` to click it, `Ctrl+C` to exit.

## `run(component, options?)`

| Option | Default | Meaning |
|---|---|---|
| `css` | `''` | Extracted CSS to load alongside the component |
| `fullscreen` | `true` | Use the alternate screen buffer |
| `mouse` | `true` | Enable mouse click/scroll/hover |
| `props` | — | Props passed to the component |
| `colorScheme` | auto | Force `'dark'`/`'light'` instead of OSC 11 detection |
| `io` | process stdio | A custom `TerminalIO` (embedding, tests) |
| `onConsole` | — | Receive `console.*` output; without it, `console.log` throws rather than corrupt the screen |
| `debug` / `debugPort` | off | WebSocket debug server |

Returns `{ cleanup, setColorScheme }`. `cleanup()` unmounts, restores the
screen and input modes; `setColorScheme('light')` re-resolves
`light-dark()` and scheme media queries on a live app.

## Writing dual-target components

The same source can render in the browser. Standard CSS behaves
identically; anything mode-specific goes in a
[`display-mode`](./terminal-css.md) block:

```css
.card {
    display: flex;
    gap: 1ch;                                   /* 1ch = 1 cell, valid both sides */
    @media (display-mode: terminal) { border: single; }
    @media (display-mode: browser)  { border: 1px solid #ccc; border-radius: 6px; }
}
```

Event payloads differ slightly: terminal events carry data on
`event.data`, browsers on the event itself — handlers that run in both
read `event.data?.value ?? event.target.value`.
