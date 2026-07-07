# DESIGN — scenario-driven E2E over the debug protocol

**COMPLETE — shipped as 0.30.0 (2026-07-07), all four slices.**

Arc 2 of PLAN-NEXT.md. Decision (Tom, 2026-07-06): extend the existing
debug server (0.17.0 `svt` CLI / 0.20.0 devtools plumbing) rather than
adding a sumi-style second control socket — one protocol serves tree
inspection AND scripted interaction.

Shape mirrors sumi's `runtime/sumitest` harness (dispatch event →
converge render → assert on text/styled snapshots), but out-of-process:
the harness drives a *real running app* through its debug socket, so a
scenario exercises the stdin parsers, run loop, renderer, and paint
exactly as a user would.

## Protocol additions

Two new domains on the existing `DebugServer` (JSON messages,
`Domain.method` routing; the server gains support for async `handle`
results — it awaits a returned Promise before replying).

### Input — inject events into the run loop

All injection flows through the same byte-level handlers the
`StdinRouter` drives (`handleKeyData` / `handleMouseData` /
`handlePaste`), so the key/mouse parsers are part of the tested path.
The server encodes semantic specs to bytes with a new
`src/input/encode.ts` — the inverse of `keyboard.ts`, mirroring sumi's
`runtime/input/encode.go`.

| Method | Params | Effect |
|---|---|---|
| `Input.key` | `{ key, ctrl?, shift?, meta? }` | one key chord, encoded then parsed |
| `Input.text` | `{ text }` | types each character |
| `Input.mouse` | `{ type: press\|release\|motion\|scroll, x, y, button? }` | SGR-encoded mouse event (0-based cell coords) |
| `Input.paste` | `{ text }` | bracketed-paste delivery |

Encoder coverage: printable ASCII, Ctrl+letter (and `Ctrl+_`),
Alt/meta as ESC prefix, named specials (Enter, Tab, Shift+Tab, Escape,
Backspace, Delete, arrows, Home/End, PageUp/Down), and CSI `1;mod`
modified arrows/Home/End. Non-ASCII typing is out of scope — the legacy
byte parser only decodes ASCII printables (kitty CSI-u covers the rest
interactively).

### Screen — frame sync + snapshots

| Method | Params | Result |
|---|---|---|
| `Screen.text` | | `{ text, width, height }` of the *displayed* buffer |
| `Screen.styled` | | styled-markup snapshot (`bufferToStyledText`) |
| `Screen.cell` | `{ x, y }` | one cell record (char + style flags) |
| `Screen.settle` | `{ timeoutMs? }` | resolves once no render is scheduled and the render queue is empty (yields through macrotasks so microtask-queued renders run); errors on timeout |

`mount()` passes the debug context three new hooks: the injection
callbacks, `displayBuffer()` (the post-diff displayed frame), and
`renderPending()` (`renderScheduled || !queue.isEmpty()`). Settling is
"until the *current* work drains" — a continuous CSS animation still
settles between its frames.

## Harness (test-side client)

`src/debug/harness.ts`, published as `@svelterm/core/harness` (same
pattern as `./headless`). Wraps a ws connection with scenario-friendly
ergonomics; every input op settles before resolving, like sumi's
`Harness.Step` runs convergence rendering:

```ts
const h = await connect({ port: 9444 })
await h.key('Tab')
await h.text('hello world')
await h.key('ArrowLeft', { ctrl: true, shift: true })
await h.click(4, 6); await h.doubleClick(4, 6)
await h.paste('...')
const screen = await h.screenText()
await h.waitForText('2 of 4 remaining', 2000)
const cell = await h.cellAt(6, 6) // { char, inverse, ... }
h.close()
```

Assertions stay plain `node:assert` against the returned strings/cells
(the JS-idiomatic version of sumi's `AssertText`); `waitForText` is the
polling helper for asynchronous UI (timers, animations).

## Acceptance scenario

A scenario test drives the *counter demo* (already `debug: true` on
port 9444): vite-build it, spawn `node dist-demo/counter/main.js` with
piped stdio (no TTY needed — injection replaces stdin), connect,
Tab-focus, activate, and assert the counter text advances on the
emulated screen. Runs via `npm run test:e2e` (kept out of the unit
glob: unit tests are `dist/**/*.test.js`; the scenario compiles to
`counter.e2e.js`).

## Slices (carpaccio, one commit each)

1. **Input injection** — `encode.ts` (round-trip tested against
   `parseKeyEvent`/`parseMouseEvent`), `InputDomain`, async `handle`
   support in server.ts, mount() wiring.
2. **Screen domain** — snapshots + `Screen.settle`, debugCtx hooks.
3. **Harness client** — `connect()`, input/settle/snapshot/waitForText
   helpers, `./harness` export; in-process integration test over a real
   ws server with recorded domains.
4. **Acceptance scenario** — counter demo end-to-end + `test:e2e`
   script; docs (debug protocol reference) + changelog.
