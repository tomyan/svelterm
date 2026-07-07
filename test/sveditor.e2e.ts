/**
 * E2E scenario for the sveditor demo: edit a real file through the
 * multiline textarea — navigate, select, save to disk, undo.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, type Harness } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/sveditor/main.js', import.meta.url))

let dir: string
let file: string
let h: Harness
let closeApp: () => void

before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'svelterm-edit-'))
    file = join(dir, 'draft.txt')
    writeFileSync(file, 'alpha line\nbeta line\ngamma line')
    const launched = await launch(DEMO_ENTRY, { env: { SVELTERM_EDIT_FILE: file } })
    h = launched.harness
    closeApp = launched.close
})

after(() => {
    closeApp?.()
    rmSync(dir, { recursive: true, force: true })
})

test('opens the file with all lines visible', async () => {
    const screen = await h.waitForText('gamma line', 5000)
    assert.match(screen, /alpha line/)
    assert.match(screen, /beta line/)
    assert.match(screen, /draft\.txt/)
})

test('navigation moves the caret and the status line:col follows', async () => {
    // Given — focus the editor (buffer starts with the caret at the end)
    await h.key('Tab')
    await h.waitForText(/3:11/, 2000)

    // When — up one line, then to the buffer start
    await h.key('ArrowUp')
    await h.waitForText(/2:10/, 2000)
    await h.key('a', { ctrl: true })
    await h.waitForText(/1:1/, 2000)
})

test('Enter splits a line', async () => {
    // Given — caret at 1:1; When — type a line and break it
    await h.text('intro')
    await h.key('Enter')

    // Then — "intro" sits alone on line 1, caret at 2:1, file modified
    const screen = await h.waitForText(/2:1\b/, 2000)
    const lines = screen.split('\n')
    const introRow = lines.findIndex(line => line.includes('intro'))
    assert.ok(introRow >= 0, 'intro renders')
    assert.match(lines[introRow + 1], /alpha line/)
    assert.match(screen, /draft\.txt ●/)
})

test('Ctrl+S writes the buffer to disk', async () => {
    // When
    await h.key('s', { ctrl: true })
    await h.waitForText('saved', 2000)

    // Then — disk matches, modified marker clears
    assert.equal(readFileSync(file, 'utf-8'), 'intro\nalpha line\nbeta line\ngamma line')
    assert.doesNotMatch(await h.screenText(), /●/)
})

test('a line-spanning selection paints and replaces', async () => {
    // Given — caret at buffer start, select one line down
    await h.key('a', { ctrl: true })
    await h.key('ArrowDown', { shift: true })

    // Then — the selected first line paints inverted
    const lines = (await h.screenText()).split('\n')
    const y = lines.findIndex(line => line.includes('intro'))
    const x = lines[y].indexOf('intro')
    assert.equal((await h.cellAt(x, y)).inverse, true)

    // When — typing replaces the selection
    await h.text('#')
    const screen = await h.waitForText(/#alpha line/, 2000)
    assert.doesNotMatch(screen, /intro/)
})

test('undo walks back and the result saves', async () => {
    // When — one undo reverts the whole selection replacement
    await h.key('_', { ctrl: true })
    await h.waitForText(/intro/, 2000)

    // And — save the restored text
    await h.key('s', { ctrl: true })
    await h.waitForText('saved', 2000)

    // Then
    assert.equal(readFileSync(file, 'utf-8'), 'intro\nalpha line\nbeta line\ngamma line')
})
