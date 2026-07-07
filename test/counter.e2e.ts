/**
 * Acceptance scenario for the E2E protocol (DESIGN-e2e.md slice 4):
 * drives the real counter demo — spawned as its own process, no TTY —
 * through the debug socket, and asserts on the emulated screen.
 *
 * Run via `npm run test:e2e` (vite-builds the demo first). Not part of
 * the unit-test glob.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { launch } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/counter/main.js', import.meta.url))

test('counter demo: focus, click, and count over the debug protocol', async () => {
    // Given — the demo launched orphan-proof (OS-assigned port, pid-checked)
    const { harness: h, close } = await launch(DEMO_ENTRY)

    try {
        // Then — the first frame paints
        await h.waitForText('Svelterm — Counter Demo', 5000)

        // When — Tab focuses the Increment button
        await h.key('Tab')
        await h.waitForText(/Focused:\s+Increment/, 2000)

        // When — Enter clicks it twice
        await h.key('Enter')
        await h.key('Enter')

        // Then — the count on screen reaches 2
        const screen = await h.waitForText(/\b2\b/, 2000)
        assert.match(screen, /Counter/)

        // When — Tab to Decrement, click once
        await h.key('Tab')
        await h.waitForText(/Focused:\s+Decrement/, 2000)
        await h.key('Enter')

        // Then — back to 1
        await h.waitForText(/\b1\b/, 2000)
    } finally {
        close()
    }
})

test('a launched app exits by itself when its stdin pipe closes', async () => {
    // Given
    const { harness, app } = await launch(DEMO_ENTRY)
    harness.close()

    // When — simulate the controlling process dying
    app.stdin!.end()

    // Then — the app exits on its own (no SIGKILL needed)
    const code = await new Promise<number | null>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('app did not exit on stdin EOF')), 3000)
        app.once('exit', exitCode => { clearTimeout(timer); resolve(exitCode) })
    })
    assert.equal(code, 0)
})
