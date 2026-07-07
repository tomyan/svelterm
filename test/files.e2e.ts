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
    mkdirSync(join(fixtureRoot, 'many'))
    for (let i = 0; i < 40; i++) {
        writeFileSync(join(fixtureRoot, 'many', `file-${String(i).padStart(2, '0')}.txt`), `${i}\n`)
    }
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
    // When — down twice: alpha → beta → many
    await h.key('ArrowDown')
    await h.key('ArrowDown')

    // Then
    await h.waitForText(/3\/5\s+many/, 2000)
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

test('selecting a directory previews its entry count', async () => {
    // Given — selection at the root on alpha
    // Then — the preview pane counts its children
    await h.waitForText('1 item', 2000)
})

test('selecting a file previews its first lines', async () => {
    // When — down to readme.md: alpha → beta → many → readme.md
    await h.key('ArrowDown')
    await h.key('ArrowDown')
    await h.key('ArrowDown')

    // Then
    const screen = await h.waitForText('Fixture readme', 2000)
    assert.match(screen, /second line/)
})

test('long listings window around the selection', async () => {
    // Given — into many/ (readme.md → many, then Enter)
    await h.key('ArrowUp')
    await h.key('Enter')
    await h.waitForText('file-00.txt', 2000)

    // When — move deep into the listing
    for (let i = 0; i < 30; i++) await h.key('ArrowDown')

    // Then — the window follows the selection
    const screen = await h.waitForText(/31\/40\s+file-30\.txt/, 2000)
    assert.match(screen, /file-29\.txt/)
    assert.doesNotMatch(screen, /file-00\.txt/)

    // Cleanup — back to the root
    await h.key('Backspace')
    await h.waitForText('zebra.txt', 2000)
})

test('clicking a row selects it; clicking again opens it', async () => {
    // Given — locate the beta/ row on screen
    const screen = await h.screenText()
    const lines = screen.split('\n')
    const y = lines.findIndex(line => line.includes('beta/'))
    const x = lines[y].indexOf('beta/') + 1

    // When — first click selects
    await h.click(x, y)
    await h.waitForText(/2\/5\s+beta/, 2000)

    // And — second click opens
    await h.click(x, y)
    await h.waitForText('(empty directory)', 2000)

    // Cleanup
    await h.key('Backspace')
    await h.waitForText('zebra.txt', 2000)
})

test('typing in the filter narrows the listing', async () => {
    // When — Tab focuses the filter, then type
    await h.key('Tab')
    await h.text('read')

    // Then — only readme.md remains
    const screen = await h.waitForText(/1\/1\s+readme\.md/, 2000)
    assert.doesNotMatch(screen, /zebra\.txt/)
})

test('Ctrl+W kills the filter word — the editing keymap works in the field', async () => {
    // When
    await h.key('w', { ctrl: true })

    // Then — the full listing returns
    const screen = await h.waitForText('zebra.txt', 2000)
    assert.match(screen, /\/5\s/)
})

test('descending clears the filter programmatically without desyncing the field', async () => {
    // Given — a filter that matches alpha, selection on it
    await h.text('alp')
    await h.waitForText(/1\/1\s+alpha/, 2000)

    // When — descend via a row click (alpha is already selected, so one
    // click opens; Enter would click the focused filter input instead)
    const screen = await h.screenText()
    const lines = screen.split('\n')
    const y = lines.findIndex(line => line.includes('alpha/'))
    const x = lines[y].indexOf('alpha/') + 1
    await h.click(x, y)
    await h.waitForText('nested.txt', 2000)

    // Then — the filter box is empty again: typing starts a fresh filter
    await h.text('zzz')
    await h.waitForText('(empty directory)', 2000)
    await h.key('w', { ctrl: true })
    await h.waitForText('nested.txt', 2000)
})
