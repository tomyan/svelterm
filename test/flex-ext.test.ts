import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { CellBuffer } from '../src/render/buffer.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 30, height = 10) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout }
}

describe('flex shorthand', () => {

    it('flex:1 sets flex-grow:1', () => {
        const { layout } = render(
            '.row{display:flex;flex-direction:row;width:20cell}.item{flex:1}',
            (root) => {
                const row = new TermNode('element', 'div')
                row.attributes.set('class', 'row')
                const a = new TermNode('element', 'div')
                a.attributes.set('class', 'item')
                const ta = new TermNode('text', 'A')
                a.insertBefore(ta, null)
                row.insertBefore(a, null)
                const b = new TermNode('element', 'div')
                b.attributes.set('class', 'item')
                const tb = new TermNode('text', 'B')
                b.insertBefore(tb, null)
                row.insertBefore(b, null)
                root.insertBefore(row, null)
            },
        )
        // Both items should fill equally — find boxes with width > 1
        const itemBoxes = [...layout.values()].filter(b => b.width > 1 && b.width < 20)
        assert.equal(itemBoxes.length, 2, 'should have 2 flex items')
        assert.equal(itemBoxes[0].width, itemBoxes[1].width, 'equal flex-grow')
        assert.ok(itemBoxes[0].width > 1)
    })
})

describe('flex-shrink', () => {

    it('shrinks children when they overflow container', () => {
        const { layout } = render(
            '.row{display:flex;flex-direction:row;width:20cell}.item{width:15cell;flex-shrink:1}',
            (root) => {
                const row = new TermNode('element', 'div')
                row.attributes.set('class', 'row')
                const a = new TermNode('element', 'div')
                a.attributes.set('class', 'item')
                const ta = new TermNode('text', 'A')
                a.insertBefore(ta, null)
                row.insertBefore(a, null)
                const b = new TermNode('element', 'div')
                b.attributes.set('class', 'item')
                const tb = new TermNode('text', 'B')
                b.insertBefore(tb, null)
                row.insertBefore(b, null)
                root.insertBefore(row, null)
            },
        )
        // Two 15-wide items in a 20-wide container should shrink
        const boxes = [...layout.values()].filter(b => b.width < 15 && b.width > 1)
        assert.equal(boxes.length, 2, 'both items should shrink')
        assert.equal(boxes[0].width + boxes[1].width, 20, 'should fill container exactly')
    })
})

describe('flex-direction reverse', () => {

    it('row-reverse reverses child order', () => {
        const { buffer } = render(
            '.row{display:flex;flex-direction:row-reverse;width:20cell}',
            (root) => {
                const row = new TermNode('element', 'div')
                row.attributes.set('class', 'row')
                const a = new TermNode('element', 'div')
                const ta = new TermNode('text', 'AAA')
                a.insertBefore(ta, null)
                row.insertBefore(a, null)
                const b = new TermNode('element', 'div')
                const tb = new TermNode('text', 'BBB')
                b.insertBefore(tb, null)
                row.insertBefore(b, null)
                root.insertBefore(row, null)
            },
        )
        // B should appear before A (reversed)
        const bCol = findChar(buffer, 'B')!
        const aCol = findChar(buffer, 'A')!
        assert.ok(bCol.col < aCol.col, 'B should be left of A in row-reverse')
    })

    it('column-reverse reverses vertical order', () => {
        const { buffer } = render(
            '.col{display:flex;flex-direction:column-reverse}',
            (root) => {
                const col = new TermNode('element', 'div')
                col.attributes.set('class', 'col')
                const a = new TermNode('element', 'div')
                const ta = new TermNode('text', 'First')
                a.insertBefore(ta, null)
                col.insertBefore(a, null)
                const b = new TermNode('element', 'div')
                const tb = new TermNode('text', 'Second')
                b.insertBefore(tb, null)
                col.insertBefore(b, null)
                root.insertBefore(col, null)
            },
        )
        const f = findChar(buffer, 'F')!
        const s = findChar(buffer, 'S')!
        assert.ok(s.row < f.row, 'Second should be above First in column-reverse')
    })
})

describe('align-self', () => {

    it('overrides parent align-items for single child', () => {
        const { buffer, layout } = render(
            '.row{display:flex;flex-direction:row;height:10cell;align-items:start}.end{align-self:end}',
            (root) => {
                const row = new TermNode('element', 'div')
                row.attributes.set('class', 'row')
                const a = new TermNode('element', 'div')
                const ta = new TermNode('text', 'A')
                a.insertBefore(ta, null)
                row.insertBefore(a, null)
                const b = new TermNode('element', 'div')
                b.attributes.set('class', 'end')
                const tb = new TermNode('text', 'B')
                b.insertBefore(tb, null)
                row.insertBefore(b, null)
                root.insertBefore(row, null)
            },
        )
        // A should be at top (align-items:start), B at bottom (align-self:end)
        const aPos = findChar(buffer, 'A')!
        const bPos = findChar(buffer, 'B')!
        assert.ok(aPos && bPos)
        assert.equal(aPos.row, 0, 'A at top')
        assert.equal(bPos.row, 9, 'B at bottom')
    })
})

function findChar(buffer: CellBuffer, char: string): { col: number; row: number } | null {
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 30; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}
