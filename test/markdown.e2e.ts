/**
 * E2E scenario for the markdown-viewer demo: render a fixture document
 * and assert every block type on the emulated screen. Debug port 9446.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect, type Harness } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/markdown/main.js', import.meta.url))

const FIXTURE = `# Fixture Doc

Intro paragraph line one
continues here.

- alpha item
- beta item

1. first
2. second

> a wise quotation

---

\`\`\`js
const answer = 42
\`\`\`

End paragraph.
`

let dir: string
let app: ChildProcess
let h: Harness

before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'svelterm-md-'))
    writeFileSync(join(dir, 'doc.md'), FIXTURE)
    app = spawn(process.execPath, [DEMO_ENTRY], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'xterm-256color', SVELTERM_MD_FILE: join(dir, 'doc.md') },
    })
    app.stdout!.resume()
    app.stderr!.resume()
    h = await connect({ port: 9446, timeoutMs: 5000 })
})

after(() => {
    h?.close()
    app?.kill('SIGKILL')
    rmSync(dir, { recursive: true, force: true })
})

test('renders every block type of the fixture', async () => {
    // Then — heading (uppercased by CSS), joined paragraph, lists,
    // quote, rule, verbatim code, trailing paragraph
    const screen = await h.waitForText('End paragraph.', 5000)
    assert.match(screen, /FIXTURE DOC/)
    assert.match(screen, /Intro paragraph line one continues here\./)
    assert.match(screen, /• alpha item/)
    assert.match(screen, /• beta item/)
    assert.match(screen, /1\. first/)
    assert.match(screen, /2\. second/)
    assert.match(screen, /▎ a wise quotation/)
    assert.match(screen, /─{5,}/)
    assert.match(screen, /const answer = 42/)
})

test('heading and code pick up their colors', async () => {
    const styled = await h.styledText()
    assert.match(styled, /FIXTURE DOC/)
    assert.match(styled, /cyan/)
    assert.match(styled, /green/)
})
