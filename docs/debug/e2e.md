# Scenario testing (E2E harness)

The debug protocol drives scripted interaction as well as inspection:
inject input, wait for the frame to settle, and assert on the emulated
screen — against the *real running app*, stdin parsers and paint
pipeline included. The in-test counterpart is
`@svelterm/core/harness`.

## Run the app under test

```ts
run(App, { css, debug: true })   // debug server on 127.0.0.1:9444
```

No TTY is needed — injected events replace stdin. The easy path is
`launch()`, which spawns the app orphan-proof:

```ts
import { launch } from '@svelterm/core/harness'

const { harness: h, app, close } = await launch('dist/main.js', {
    env: { MY_FIXTURE: '/tmp/fixture' },
})
// ... drive h ...
close()
```

`launch()` sets three environment variables the core understands:

- `SVELTERM_DEBUG_PORT=0` — overrides the app's `debugPort` option; `0`
  binds an OS-assigned port, so parallel tests never collide.
- `SVELTERM_DEBUG_PORT_FILE=<path>` — the app writes the bound port
  there once the server is up; `launch()` polls it.
- `SVELTERM_EXIT_ON_STDIN_END=1` — the app treats stdin EOF as
  "controlling process died" and exits cleanly, so a crashed or killed
  test run cannot leave orphans behind. (Opt-in: `curl app.mjs |
  node -` exhausts stdin at startup and must keep running.)

The connection is also pid-verified against the spawned child — if an
orphan from an earlier run somehow still holds the port, `connect`
fails with a message naming both pids instead of silently driving the
wrong app.

## Drive it

```ts
import { connect } from '@svelterm/core/harness'
import assert from 'node:assert/strict'

// connect() attaches to an already-running app (launch() calls it for you)
const h = await connect({ port: 9444, timeoutMs: 5000 }) // retries while the app boots

await h.waitForText('My App', 5000)   // first frame painted
await h.key('Tab')                    // focus
await h.key('Enter')                  // activate
await h.text('hello world')           // type into a focused input
await h.key('ArrowLeft', { ctrl: true, shift: true }) // chords
await h.click(4, 6)                   // 0-based cell coords
await h.doubleClick(4, 6)             // word-select in a field
await h.paste('clipboard text')

assert.match(await h.screenText(), /hello world/)
const cell = await h.cellAt(6, 6)     // { char, fg, bg, inverse, … }
assert.equal(cell.inverse, true)      // e.g. a selection highlight
h.close()
```

Every input helper settles the render loop before resolving, so the
next snapshot reflects the event. `waitForText(pattern, timeoutMs)`
polls for asynchronous UI (timers, animations) and includes the last
screen in its timeout error. `h.request(method, params)` reaches any
protocol method, including the DOM/CSS inspection domains.

## Protocol domains

For non-JS clients, the wire protocol is JSON over the WebSocket:
`{ id, method: "Domain.method", params }` → `{ id, result }` or
`{ id, error: { message } }`.

| Method | Params | Notes |
|---|---|---|
| `Input.key` | `{ key, ctrl?, shift?, meta? }` | key names as in `KeyEvent` (`"a"`, `"Tab"`, `"ArrowLeft"`…); encoded to real terminal bytes and fed through the parsers |
| `Input.text` | `{ text }` | one key per character |
| `Input.mouse` | `{ type, x, y, button? }` | `press`/`release`/`motion`/`scroll`, 0-based cells |
| `Input.paste` | `{ text }` | bracketed-paste delivery |
| `Screen.text` | | `{ text, width, height }` of the displayed frame; row-faithful — line N is screen row N, so mouse coordinates can be derived from it |
| `Screen.styled` | | styled markup (colors/attributes) |
| `Screen.cell` | `{ x, y }` | one cell record |
| `Screen.settle` | `{ timeoutMs? }` | replies once no render is pending |
| `Runtime.info` | | `{ pid, startedAt }` of the app process |

`test/counter.e2e.ts` is the reference scenario (run with
`npm run test:e2e`); [svt](./svt.md) and [DevTools](./devtools.md)
cover the inspection domains.
