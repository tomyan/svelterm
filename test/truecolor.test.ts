import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { diffBuffers } from '../src/render/diff.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function renderAndDiff(css: string, buildTree: (root: TermNode) => void, width = 20, height = 3) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, ansi: diffBuffers(null, buffer) }
}

describe('truecolor end-to-end', () => {

    it('non-ANSI hex color stored as hex in buffer', () => {
        const { buffer } = renderAndDiff('.t{color:#ff8800}', (root) => {
            const span = new TermNode('element', 'span')
            span.attributes.set('class', 't')
            const text = new TermNode('text', 'Hi')
            span.insertBefore(text, null)
            root.insertBefore(span, null)
        })
        assert.equal(buffer.getCell(0, 0)?.fg, '#ff8800')
    })

    it('hex fg color produces 38;2;r;g;b ANSI sequence', () => {
        const { ansi } = renderAndDiff('.t{color:#ff8800}', (root) => {
            const span = new TermNode('element', 'span')
            span.attributes.set('class', 't')
            const text = new TermNode('text', 'X')
            span.insertBefore(text, null)
            root.insertBefore(span, null)
        })
        assert.ok(ansi.includes('\x1b[38;2;255;136;0m'), `expected truecolor fg, got: ${ansi.substring(0, 100)}`)
    })

    it('hex bg color produces 48;2;r;g;b ANSI sequence', () => {
        const { ansi } = renderAndDiff('.t{background-color:#1a1a2e;width:3px;height:1px}', (root) => {
            const div = new TermNode('element', 'div')
            div.attributes.set('class', 't')
            root.insertBefore(div, null)
        })
        assert.ok(ansi.includes('\x1b[48;2;26;26;46m'), `expected truecolor bg`)
    })

    it('3-digit hex expands and renders as truecolor', () => {
        const { buffer } = renderAndDiff('.t{color:#f80}', (root) => {
            const span = new TermNode('element', 'span')
            span.attributes.set('class', 't')
            const text = new TermNode('text', 'X')
            span.insertBefore(text, null)
            root.insertBefore(span, null)
        })
        assert.equal(buffer.getCell(0, 0)?.fg, '#ff8800')
    })

    it('ANSI-exact hex still uses named color', () => {
        const { buffer } = renderAndDiff('.t{color:#0ff}', (root) => {
            const span = new TermNode('element', 'span')
            span.attributes.set('class', 't')
            const text = new TermNode('text', 'X')
            span.insertBefore(text, null)
            root.insertBefore(span, null)
        })
        // #0ff = cyan, should resolve to named ANSI for efficiency
        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
    })
})
