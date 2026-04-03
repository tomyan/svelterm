import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function findChar(buffer: CellBuffer, char: string): { col: number; row: number } | null {
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 40; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('order property', () => {

    it('reorders flex items visually', () => {
        const root = new TermNode('element', 'root')
        const css = '.row{display:flex;flex-direction:row}.a{order:3}.b{order:1}.c{order:2}'
        const sheet = parseCSS(css)

        const row = new TermNode('element', 'div')
        row.attributes.set('class', 'row')

        const a = new TermNode('element', 'div')
        a.attributes.set('class', 'a')
        a.insertBefore(new TermNode('text', 'A'), null)
        row.insertBefore(a, null)

        const b = new TermNode('element', 'div')
        b.attributes.set('class', 'b')
        b.insertBefore(new TermNode('text', 'B'), null)
        row.insertBefore(b, null)

        const c = new TermNode('element', 'div')
        c.attributes.set('class', 'c')
        c.insertBefore(new TermNode('text', 'C'), null)
        row.insertBefore(c, null)

        root.insertBefore(row, null)

        const styles = resolveStyles(root, sheet)
        const layout = computeLayout(root, styles, 40, 10)
        const buffer = new CellBuffer(40, 10)
        paint(root, buffer, styles, layout)

        // DOM order: A, B, C. order values: 3, 1, 2
        // Visual order should be: B(1), C(2), A(3)
        const posB = findChar(buffer, 'B')!
        const posC = findChar(buffer, 'C')!
        const posA = findChar(buffer, 'A')!
        assert.ok(posB.col < posC.col, 'B before C')
        assert.ok(posC.col < posA.col, 'C before A')
    })
})
