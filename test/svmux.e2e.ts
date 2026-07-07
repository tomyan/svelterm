/**
 * E2E scenario for the svmux demo: two real shells in panes via
 * node-pty, keys routed to the active pane, Alt+1/Alt+2 switching.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { launch, type Harness } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/svmux/main.js', import.meta.url))

let h: Harness
let closeApp: () => void

before(async () => {
    const launched = await launch(DEMO_ENTRY, {
        env: {
            SVELTERM_MUX_CMD: 'bash',
            SVELTERM_MUX_ARGS: '--norc --noprofile -i',
            PS1: 'mux$ ',
        },
    })
    h = launched.harness
    closeApp = launched.close
})

after(() => closeApp?.())

test('both panes boot a shell prompt', async () => {
    // Then — two prompts render (one per pane)
    const screen = await h.waitForText('mux$', 10_000)
    const prompts = screen.match(/mux\$/g) ?? []
    assert.ok(prompts.length >= 2, `expected 2 prompts, saw ${prompts.length}`)
    assert.match(screen, /pane 1\/2/)
})

test('typed keys reach the active pane shell', async () => {
    // When
    await h.text('echo pane-one-marker')
    await h.key('Enter')

    // Then — the command echo and its output land in pane 1
    await h.waitForText('pane-one-marker', 5000)
})

test('Alt+2 switches panes and keys follow', async () => {
    // When
    await h.key('2', { meta: true })
    await h.waitForText(/pane 2\/2/, 2000)
    await h.text('echo pane-two-marker')
    await h.key('Enter')

    // Then — output lands in pane 2 while pane 1 keeps its own
    const screen = await h.waitForText('pane-two-marker', 5000)
    assert.match(screen, /pane-one-marker/)
})

test('the shells sit side by side', async () => {
    // Then — the top border row shows two pane frames with a gap
    const lines = (await h.screenText()).split('\n')
    const top = lines.find(line => line.includes('┌'))
    assert.ok(top, 'pane borders render')
    assert.match(top!, /┐\s+┌/)
})
