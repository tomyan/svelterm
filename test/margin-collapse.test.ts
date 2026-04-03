import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 20) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout, styles }
}

function findChar(buffer: CellBuffer, char: string, w = 40, h = 20): { col: number; row: number } | null {
    for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('margin collapsing', () => {

    it('adjacent vertical margins collapse to the larger value', () => {
        const { buffer } = render(
            '.a{margin-bottom:2cell}.b{margin-top:3cell}',
            (root) => {
                const a = new TermNode('element', 'div')
                a.attributes.set('class', 'a')
                const ta = new TermNode('text', 'A')
                a.insertBefore(ta, null)
                root.insertBefore(a, null)

                const b = new TermNode('element', 'div')
                b.attributes.set('class', 'b')
                const tb = new TermNode('text', 'B')
                b.insertBefore(tb, null)
                root.insertBefore(b, null)
            },
        )
        const posA = findChar(buffer, 'A')!
        const posB = findChar(buffer, 'B')!
        assert.ok(posA && posB)
        // Gap should be 3 (the larger), not 5 (sum)
        const gap = posB.row - posA.row - 1
        assert.equal(gap, 3, `expected 3 cell gap (collapsed), got ${gap}`)
    })

    it('equal margins collapse to one', () => {
        const { buffer } = render(
            '.a{margin-bottom:2cell}.b{margin-top:2cell}',
            (root) => {
                const a = new TermNode('element', 'div')
                a.attributes.set('class', 'a')
                const ta = new TermNode('text', 'X')
                a.insertBefore(ta, null)
                root.insertBefore(a, null)

                const b = new TermNode('element', 'div')
                b.attributes.set('class', 'b')
                const tb = new TermNode('text', 'Y')
                b.insertBefore(tb, null)
                root.insertBefore(b, null)
            },
        )
        const posX = findChar(buffer, 'X')!
        const posY = findChar(buffer, 'Y')!
        const gap = posY.row - posX.row - 1
        assert.equal(gap, 2, `expected 2 cell gap (collapsed), got ${gap}`)
    })
})

describe('text-decoration inheritance', () => {

    it('text-decoration does not inherit to child elements', () => {
        const { styles } = render(
            '.parent{text-decoration:underline}.child{color:red}',
            (root) => {
                const parent = new TermNode('element', 'div')
                parent.attributes.set('class', 'parent')
                const child = new TermNode('element', 'span')
                child.attributes.set('class', 'child')
                const text = new TermNode('text', 'Hi')
                child.insertBefore(text, null)
                parent.insertBefore(child, null)
                root.insertBefore(parent, null)
            },
        )
        // Per CSS spec, text-decoration does NOT inherit.
        // The child should not have underline set on its resolved style.
        const childStyle = [...styles.values()].find(s => s.fg === 'red')
        assert.ok(childStyle)
        assert.equal(childStyle!.underline, false, 'child should not have underline in resolved style')
    })
})
