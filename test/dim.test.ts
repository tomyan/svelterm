import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 5) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe('dim text', () => {

    it('opacity:dim renders dim text', () => {
        const buffer = render('.muted{opacity:dim}', (root) => {
            const el = new TermNode('element', 'span')
            el.attributes.set('class', 'muted')
            const text = new TermNode('text', 'Faded')
            el.insertBefore(text, null)
            root.insertBefore(el, null)
        })
        assert.equal(buffer.getCell(0, 0)?.dim, true)
    })

    it('non-dim content is not dim', () => {
        const buffer = render('.normal{color:cyan}', (root) => {
            const el = new TermNode('element', 'span')
            el.attributes.set('class', 'normal')
            const text = new TermNode('text', 'Bright')
            el.insertBefore(text, null)
            root.insertBefore(el, null)
        })
        assert.equal(buffer.getCell(0, 0)?.dim, false)
    })
})
