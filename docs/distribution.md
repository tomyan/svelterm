# Shipping terminal apps

The playground proves components in a browser-hosted emulator; this page
is about the other half — running the same code in real terminals, and
packaging it so other people can.

## Try it: the playground demos in your terminal

Every playground example is also published as a single self-contained
module:

```bash
curl -fsSL https://svelterm.dev/run/counter.mjs | node --input-type=module -
```

(`https://svelterm.dev/run.txt` lists them all.) The `.mjs` has the
component, its CSS, svelterm, and the Svelte runtime bundled flat — the
only requirement is Node 20+.

Piping a script into `node -` normally costs you interactivity, because
stdin *is* the script. svelterm's `ProcessIO` handles this: when stdin is
not a TTY it reopens the controlling terminal (`/dev/tty`) for input, so
Tab/Enter/mouse keep working. On Windows (no `/dev/tty`), download first:
`curl -o app.mjs … && node app.mjs`.

## Bundling an app

The demo endpoint is also the reference recipe
(`svelterm-site/scripts/build-demos.mjs`): compile the component with the
custom renderer, wrap it in a `run()` bootstrap, and bundle for Node.
The shape, with any bundler (rolldown shown; esbuild works the same way):

```js
// 1. compile — terminal variant
const { js, css } = compile(source, {
    generate: 'client',
    css: 'external',
    experimental: { customRenderer: '@svelterm/core' },
})

// 2. bootstrap
//   import App from './App.js'
//   import { run } from '@svelterm/core/app'
//   run(App, { css: <extracted css string> })

// 3. bundle: platform node, single-file ESM output
const bundle = await rolldown({ input: 'entry.js', platform: 'node' })
await bundle.write({ format: 'esm', file: 'app.mjs', codeSplitting: false })
```

In a Vite project, `@svelterm/core/vite` configures the compiler side for
you; the bundle step is the same. Result: one `.mjs`, ~350 kB, no
`node_modules` at runtime.

## Distribution options

**A URL** — host the `.mjs` anywhere static and document the `curl | node -`
line. Zero install, easiest to keep current; requires Node on the
machine. This is what svelterm.dev/run does.

**An npm package** — point `bin` at a small launcher that imports your
bundle, and users run `npx your-app` (or install it globally). Works
wherever npm does; versioning and updates come free.

```json
{ "name": "your-app", "bin": { "your-app": "./app.mjs" }, "engines": { "node": ">=20" } }
```

(Add `#!/usr/bin/env node` at the top of the bundle for the bin path.)

**A single executable** — bundle the runtime in, so users need nothing:

- `bun build --compile app.mjs --outfile your-app` produces a per-platform
  binary (~90 MB).
- Node's [single executable applications](https://nodejs.org/api/single-executable-applications.html)
  inject the bundle into a copied `node` binary.
- `deno compile` similarly, via Deno's Node compatibility.

These are documented paths rather than tested ones — the `.mjs` bundles
are what svelterm exercises today (Node 20+, verified on macOS/Linux
terminals). Bun and Deno run Node-flavoured code well and the bundles
avoid native dependencies entirely, but treat them as "should work,
verify" until the test matrix says otherwise.

## What svelterm needs from a terminal

Any reasonably modern emulator qualifies: raw mode, cursor addressing,
and 16-colour ANSI at minimum. Truecolor is used when hex colours appear
(near-universal now); mouse support needs SGR mouse mode; synchronized
updates are used when available and harmless when not. The alternate
screen buffer hosts fullscreen apps (`fullscreen: false` opts out).
Windows Terminal covers all of this on Windows.

## A testing story for real terminals

Three layers, increasing in realism:

1. **Headless** — `@svelterm/core/headless` renders components to cell
   buffers in plain Node for unit tests; svelterm's own thousand-test
   suite runs this way.
2. **The playground** — visual verification in the browser emulator,
   side by side with the DOM render.
3. **The bundles** — pipe a demo (or your own app's bundle) into a real
   terminal. This is scriptable too: run the bundle inside `tmux`, drive
   it with `tmux send-keys`, assert on `tmux capture-pane` — a real
   PTY, real escape-sequence parsing, no emulator in the loop.
