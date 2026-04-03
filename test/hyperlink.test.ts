import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { diffBuffers } from '../src/render/diff.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'

function renderAndDiff(buildTree: (root: TermNode) => void, width = 40, height = 5) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(DEFAULT_STYLESHEET)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, ansi: diffBuffers(null, buffer) }
}

describe('OSC 8 hyperlinks', () => {

    it('a element with href stores hyperlink on cells', () => {
        const { buffer } = renderAndDiff((root) => {
            const a = new TermNode('element', 'a')
            a.attributes.set('href', 'https://example.com')
            const text = new TermNode('text', 'Link')
            a.insertBefore(text, null)
            root.insertBefore(a, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'L')
        assert.equal(buffer.getCell(0, 0)?.hyperlink, 'https://example.com')
        assert.equal(buffer.getCell(3, 0)?.hyperlink, 'https://example.com')
    })

    it('ANSI output includes OSC 8 sequences', () => {
        const { ansi } = renderAndDiff((root) => {
            const a = new TermNode('element', 'a')
            a.attributes.set('href', 'https://example.com')
            const text = new TermNode('text', 'Click')
            a.insertBefore(text, null)
            root.insertBefore(a, null)
        })
        // OSC 8 open: ESC ] 8 ; ; url ST
        assert.ok(ansi.includes('\x1b]8;;https://example.com\x1b\\'), 'should contain OSC 8 open')
        // OSC 8 close: ESC ] 8 ; ; ST
        assert.ok(ansi.includes('\x1b]8;;\x1b\\'), 'should contain OSC 8 close')
    })

    it('non-link text has no hyperlink', () => {
        const { buffer } = renderAndDiff((root) => {
            const text = new TermNode('text', 'Plain')
            root.insertBefore(text, null)
        })
        assert.equal(buffer.getCell(0, 0)?.hyperlink, undefined)
    })
})
