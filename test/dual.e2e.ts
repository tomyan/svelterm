/**
 * E2E scenario for the dual-target demo. The terminal side runs live;
 * the browser side is verified as a build artifact (the same App.svelte
 * compiled as DOM Svelte — `npm run demo:dual-web` serves it).
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { launch, type Harness } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/dual/main.js', import.meta.url))
const WEB_DIR = fileURLToPath(new URL('../../dist-demo/dual-web', import.meta.url))

let h: Harness
let closeApp: () => void

before(async () => {
    const launched = await launch(DEMO_ENTRY)
    h = launched.harness
    closeApp = launched.close
})

after(() => closeApp?.())

test('terminal target: renders and the buttons work', async () => {
    // Given
    await h.waitForText('Dual target', 5000)

    // When — Tab to +1, click it twice
    await h.key('Tab')
    await h.key('Enter')
    await h.key('Enter')

    // Then
    await h.waitForText(/count\s+2/, 2000)

    // When — bump the gauge
    await h.key('Tab')
    await h.key('Enter')

    // Then — four filled cells
    await h.waitForText(/████░░░░/, 2000)
})

test('browser target: the same component builds as DOM Svelte', () => {
    // Then — the web bundle exists and carries the component markup
    assert.ok(existsSync(join(WEB_DIR, 'index.html')), 'index.html built')
    const assets = readdirSync(join(WEB_DIR, 'assets'))
    const js = assets.find(name => name.endsWith('.js'))
    assert.ok(js, 'a JS bundle built')
    const bundle = readFileSync(join(WEB_DIR, 'assets', js!), 'utf-8')
    assert.match(bundle, /Dual target/)
    assert.match(bundle, /bump/)
})
