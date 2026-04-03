import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 10) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    // resolveStyles handles @container queries via two-pass with layout
    const styles = resolveStyles(root, stylesheet, undefined, width, height)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, styles, layout }
}

function findChar(buffer: CellBuffer, char: string, w = 40, h = 10): { col: number; row: number } | null {
    for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('@container queries', () => {

    it('parses @container block', () => {
        const sheet = parseCSS('@container (min-width: 20) { .t { color: cyan; } }')
        assert.equal(sheet.rules.length, 1)
        assert.ok(sheet.rules[0].container)
        assert.equal(sheet.rules[0].container, 'min-width: 20')
    })

    it('applies rule when container is wide enough', () => {
        const { buffer } = render(
            '.box{width:30cell} @container (min-width: 20) { .inner { color: cyan; } }',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const inner = new TermNode('element', 'span')
                inner.attributes.set('class', 'inner')
                const text = new TermNode('text', 'Hi')
                inner.insertBefore(text, null)
                box.insertBefore(inner, null)
                root.insertBefore(box, null)
            },
        )
        const pos = findChar(buffer, 'H')!
        assert.ok(pos)
        assert.equal(buffer.getCell(pos.col, pos.row)?.fg, 'cyan')
    })

    it('does not apply when container is too narrow', () => {
        const { buffer } = render(
            '.box{width:10cell} @container (min-width: 20) { .inner { color: cyan; } }',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const inner = new TermNode('element', 'span')
                inner.attributes.set('class', 'inner')
                const text = new TermNode('text', 'Hi')
                inner.insertBefore(text, null)
                box.insertBefore(inner, null)
                root.insertBefore(box, null)
            },
        )
        const pos = findChar(buffer, 'H')!
        assert.ok(pos)
        assert.equal(buffer.getCell(pos.col, pos.row)?.fg, 'default')
    })
})
