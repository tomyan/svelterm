/**
 * E2E scenario for the file-browser demo: list a fixture tree, move the
 * selection with arrows, descend with Enter, come back with Backspace.
 * Run via `npm run test:e2e`. The demo's debug server sits on 9445 so
 * the counter scenario (9444) can run in a parallel test process.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, type Harness } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/files/main.js', import.meta.url))

let fixtureRoot: string
let app: ChildProcess
let h: Harness

before(async () => {
    // Given — a small fixture tree
    fixtureRoot = mkdtempSync(join(tmpdir(), 'svelterm-files-'))
    mkdirSync(join(fixtureRoot, 'alpha'))
    writeFileSync(join(fixtureRoot, 'alpha', 'nested.txt'), 'nested file contents\n')
    mkdirSync(join(fixtureRoot, 'beta'))
    writeFileSync(join(fixtureRoot, 'readme.md'), '# Fixture readme\nsecond line\n')
    writeFileSync(join(fixtureRoot, 'zebra.txt'), 'stripes\n')

    app = spawn(process.execPath, [DEMO_ENTRY], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'xterm-256color', SVELTERM_BROWSE_ROOT: fixtureRoot },
    })
    app.stdout!.resume()
    app.stderr!.resume()
    h = await connect({ port: 9445, timeoutMs: 5000 })
})

after(() => {
    h?.close()
    app?.kill('SIGKILL')
    rmSync(fixtureRoot, { recursive: true, force: true })
})

test('lists the fixture tree, directories first', async () => {
    const screen = await h.waitForText('zebra.txt', 5000)
    assert.match(screen, /alpha\//)
    assert.match(screen, /beta\//)
    assert.match(screen, /readme\.md/)
    // Directories sort before files
    assert.ok(screen.indexOf('beta/') < screen.indexOf('readme.md'))
})

test('arrows move the selection, shown in the status line', async () => {
    // When — down twice: alpha → beta → readme.md
    await h.key('ArrowDown')
    await h.key('ArrowDown')

    // Then
    await h.waitForText(/3\/4\s+readme\.md/, 2000)
})

test('Enter descends into a directory', async () => {
    // Given — selection back on alpha
    await h.key('ArrowUp')
    await h.key('ArrowUp')

    // When
    await h.key('Enter')

    // Then — inside alpha
    const screen = await h.waitForText('nested.txt', 2000)
    assert.match(screen, /alpha/)
    assert.doesNotMatch(screen, /zebra\.txt/)
})

test('Backspace returns to the parent, not above the root', async () => {
    // When
    await h.key('Backspace')
    await h.waitForText('zebra.txt', 2000)

    // And — another Backspace at the root stays put
    await h.key('Backspace')
    const screen = await h.waitForText('zebra.txt', 2000)
    assert.match(screen, /alpha\//)
})
