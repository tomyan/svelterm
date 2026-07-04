# Getting started

svelterm runs Svelte components in a terminal. You write ordinary Svelte —
markup, scoped `<style>`, runes, event handlers — and the renderer lays it
out on a character-cell grid instead of a browser DOM.

## Prerequisites

svelterm builds on Svelte's experimental custom renderer API
([sveltejs/svelte#18042](https://github.com/sveltejs/svelte/pull/18042)).
Until [#18505](https://github.com/sveltejs/svelte/pull/18505) lands, use
the svelterm fork of that branch (upstream plus the `svelte/renderer`
mount export svelterm needs on Node):

```bash
git clone -b svelte-custom-renderer https://github.com/tomyan/svelte.git svelte-fork
cd svelte-fork
pnpm install
pnpm -C packages/svelte build
```

## Scaffold a project

```bash
npx @svelterm/core init my-app        # or: svelterm init my-app
cd my-app
npm install
```

The scaffold expects the Svelte fork as a sibling directory
(`../svelte-fork`) — adjust the `svelte` path in `package.json` if yours
lives elsewhere. It contains a counter component, a vite config, and
three scripts:

```bash
npm run dev    # vite dev server (terminal 1)
npm run app    # the app itself, hot-reloading (terminal 2)
npm run build  # one self-contained dist/app.mjs
```

## Dev mode

`svelterm dev <url>` connects to the vite dev server over WebSocket and
renders the app in *its own* terminal — the server terminal keeps logs
and errors readable:

- Edits to any imported module restart the app in place.
- `console.log` from the app appears in the **vite terminal**, prefixed
  `[svelterm]` — the app's terminal is its screen.
- `Ctrl+C` in the app terminal exits and restores the screen.

Terminal-only projects need no `vite-plugin-svelte`: svelterm's
`terminalServer()` plugin compiles `.svelte` files for the terminal
environment itself.

## Shipping

`svelterm build [entry.svelte]` bundles the component graph, the Svelte
runtime, and svelterm into one `.mjs` (default `dist/app.mjs`) that runs
with plain `node` — no `node_modules` at the destination:

```bash
npx svelterm build src/App.svelte -o dist/app.mjs
node dist/app.mjs
```

Global CSS is picked up from `src/main.css`/`main.css` (or the
`--css` flag); each component's scoped styles travel inside the bundle.
See
[distribution](./distribution.md) for platform packaging and the
curl-pipe pattern.

## Manual setup

An existing project needs the compiler pointed at svelterm's renderer
with CSS kept external. With the environment-aware `vite-plugin-svelte`
fork (needed for dual-target; terminal-only projects can rely on
`terminalServer()` instead):

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { svelterm } from '@svelterm/core/vite'

export default defineConfig({
    plugins: [
        ...svelterm.terminalServer({ entry: './src/App.svelte' }),
    ],
    environments: svelterm.environments(),
    optimizeDeps: { exclude: ['svelte'] },
    ssr: { noExternal: ['svelte'] },
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

Run it programmatically (the CLI does this for you):

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
| `css` | registered CSS | Extracted CSS; defaults to styles components registered via `registerComponentCss` (bundles do this automatically) |
| `fullscreen` | `true` | Use the alternate screen buffer |
| `mouse` | `true` | Enable mouse click/scroll/hover |
| `props` | — | Props passed to the component |
| `colorScheme` | auto | Force `'dark'`/`'light'` instead of OSC 11 detection |
| `io` | process stdio | A custom `TerminalIO` (embedding, tests) |
| `onConsole` | — | Receive `console.*` output; without it, `console.log` throws rather than corrupt the screen |
| `mode` | `'fullscreen'` | `'inline'` renders at the shell cursor — see [inline mode](./inline-mode.md) |
| `exitOn` | `['ctrl+c']` | Add `'ctrl+d'` for EOF-style exit |
| `colorDepth` | detected | Force `'truecolor' \| '256' \| '16' \| 'mono'` |
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

Dual-target builds compile per environment, which needs the
environment-aware [`vite-plugin-svelte` fork](https://github.com/sveltejs/vite-plugin-svelte/pull/1318)
and the `svelterm.svelteOptions()` helper.

Event payloads differ slightly: terminal events carry data on
`event.data`, browsers on the event itself — handlers that run in both
read `event.data?.value ?? event.target.value`.
