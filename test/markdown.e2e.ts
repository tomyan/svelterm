/**
 * E2E scenario for the markdown-viewer demo: render a fixture document
 * and assert every block type on the emulated screen.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch, type Harness } from '../src/debug/harness.js'

const DEMO_ENTRY = fileURLToPath(new URL('../../dist-demo/markdown/main.js', import.meta.url))

const FIXTURE = `# Fixture Doc

Intro paragraph line one
continues **strongly** with _grace_, \`inline code\` and a [pointer](https://example.com).

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

${Array.from({ length: 30 }, (_, i) => `Section ${i} body text.\n`).join('\n')}
THE END
`

let dir: string
let h: Harness
let closeApp: () => void

before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'svelterm-md-'))
    writeFileSync(join(dir, 'doc.md'), FIXTURE)
    const launched = await launch(DEMO_ENTRY, { env: { SVELTERM_MD_FILE: join(dir, 'doc.md') } })
    h = launched.harness
    closeApp = launched.close
})

after(() => {
    closeApp?.()
    rmSync(dir, { recursive: true, force: true })
})

test('renders every block type of the fixture', async () => {
    // Then — heading (uppercased by CSS), joined paragraph, lists,
    // quote, rule, verbatim code, trailing paragraph
    const screen = await h.waitForText('End paragraph.', 5000)
    assert.match(screen, /FIXTURE DOC/)
    // Inline markers render as styled text, not literals (may wrap)
    assert.match(screen, /continues strongly with grace, inline code and a\s+pointer\./)
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

test('keys scroll the document', async () => {
    // Given — the tail is out of the viewport
    assert.doesNotMatch(await h.screenText(), /THE END/)

    // When — page down through the document
    for (let i = 0; i < 10; i++) await h.key('PageDown')

    // Then — the tail is visible, the head has scrolled away
    const bottom = await h.waitForText('THE END', 2000)
    assert.doesNotMatch(bottom, /FIXTURE DOC/)

    // And — paging back returns to the head
    for (let i = 0; i < 10; i++) await h.key('PageUp')
    await h.waitForText('FIXTURE DOC', 2000)
})

test('the mouse wheel scrolls too', async () => {
    // When — wheel down over the document
    for (let i = 0; i < 8; i++) {
        await h.request('Input.mouse', { type: 'scroll', x: 20, y: 10, button: 'scrollDown' })
    }
    await h.settle()

    // Then
    const screen = await h.screenText()
    assert.doesNotMatch(screen, /FIXTURE DOC/)
    assert.match(screen, /Section/)

    // Cleanup — back to the top for any later test
    for (let i = 0; i < 10; i++) await h.key('PageUp')
    await h.waitForText('FIXTURE DOC', 2000)
})

test('inline formatting styles the exact cells', async () => {
    // Given — locate the styled words on the row-faithful screen
    const lines = (await h.screenText()).split('\n')
    const at = (word: string) => {
        const y = lines.findIndex(line => line.includes(word))
        return { x: lines[y].indexOf(word), y }
    }

    // Then — bold, italic, and underlined-link cells
    const strong = at('strongly')
    assert.equal((await h.cellAt(strong.x, strong.y)).bold, true)
    const em = at('grace')
    assert.equal((await h.cellAt(em.x, em.y)).italic, true)
    const link = at('pointer')
    assert.equal((await h.cellAt(link.x, link.y)).underline, true)
})
