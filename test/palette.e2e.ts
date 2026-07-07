/**
 * E2E scenario for the colour-palette demo: the sections render and the
 * swatch cells carry their background colours. Debug port 9447.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { connect, type Harness } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/palette/main.js', import.meta.url))

let app: ChildProcess
let h: Harness

before(async () => {
    app = spawn(process.execPath, [DEMO_ENTRY], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    })
    app.stdout!.resume()
    app.stderr!.resume()
    h = await connect({ port: 9447, timeoutMs: 5000 })
})

after(() => {
    h?.close()
    app?.kill('SIGKILL')
})

test('all palette sections render', async () => {
    const screen = await h.waitForText('Grayscale ramp', 5000)
    assert.match(screen, /ANSI colours/)
    assert.match(screen, /256-colour cube/)
    assert.match(screen, /24-bit hue sweep/)
})

async function rowBackgrounds(y: number, width = 60): Promise<string[]> {
    const bgs: string[] = []
    for (let x = 0; x < width; x++) bgs.push(String((await h.cellAt(x, y)).bg))
    return bgs
}

test('swatch cells carry background colours', async () => {
    // Given — the ANSI swatch row
    const lines = (await h.screenText()).split('\n')
    const ansiY = lines.findIndex(line => line.includes('ANSI colours')) + 1

    // Then — the eight named backgrounds appear in order
    const bgs = await rowBackgrounds(ansiY)
    const named = bgs.filter(bg => bg !== 'default')
    assert.deepEqual([...new Set(named)],
        ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'])
    // Each swatch is two cells wide
    assert.equal(named.length, 16)

    // And — the truecolor sweep uses concrete rgb backgrounds
    const sweepY = lines.findIndex(line => line.includes('24-bit hue sweep')) + 1
    const sweep = (await rowBackgrounds(sweepY)).filter(bg => bg !== 'default')
    assert.ok(sweep.length >= 50, `sweep cells: ${sweep.length}`)
    assert.match(sweep[0], /^#[0-9a-f]{6}$/i)
    assert.ok(new Set(sweep).size > 30, 'sweep hues vary')
})
