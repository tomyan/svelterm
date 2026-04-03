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
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout }
}

function findChar(buffer: CellBuffer, char: string, w = 40, h = 10): { col: number; row: number } | null {
    for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('CSS Grid', () => {

    describe('grid-template-columns', () => {

        it('places children in columns defined by template', () => {
            const { buffer } = render(
                '.grid{display:grid;grid-template-columns:10cell 10cell 10cell}',
                (root) => {
                    const grid = new TermNode('element', 'div')
                    grid.attributes.set('class', 'grid')
                    for (const label of ['A', 'B', 'C']) {
                        const child = new TermNode('element', 'div')
                        child.insertBefore(new TermNode('text', label), null)
                        grid.insertBefore(child, null)
                    }
                    root.insertBefore(grid, null)
                },
            )
            const a = findChar(buffer, 'A')!
            const b = findChar(buffer, 'B')!
            const c = findChar(buffer, 'C')!
            assert.equal(a.row, 0)
            assert.equal(b.row, 0)
            assert.equal(c.row, 0)
            assert.equal(a.col, 0)
            assert.equal(b.col, 10)
            assert.equal(c.col, 20)
        })

        it('wraps to next row when columns are full', () => {
            const { buffer } = render(
                '.grid{display:grid;grid-template-columns:10cell 10cell}',
                (root) => {
                    const grid = new TermNode('element', 'div')
                    grid.attributes.set('class', 'grid')
                    for (const label of ['A', 'B', 'C', 'D']) {
                        const child = new TermNode('element', 'div')
                        child.insertBefore(new TermNode('text', label), null)
                        grid.insertBefore(child, null)
                    }
                    root.insertBefore(grid, null)
                },
            )
            const a = findChar(buffer, 'A')!
            const b = findChar(buffer, 'B')!
            const c = findChar(buffer, 'C')!
            const d = findChar(buffer, 'D')!
            // Row 0: A, B
            assert.equal(a.row, 0)
            assert.equal(b.row, 0)
            // Row 1: C, D
            assert.equal(c.row, 1)
            assert.equal(d.row, 1)
            assert.equal(c.col, 0)
            assert.equal(d.col, 10)
        })

        it('supports percentage column widths', () => {
            const { buffer } = render(
                '.grid{display:grid;grid-template-columns:50% 50%;width:20cell}',
                (root) => {
                    const grid = new TermNode('element', 'div')
                    grid.attributes.set('class', 'grid')
                    const a = new TermNode('element', 'div')
                    a.insertBefore(new TermNode('text', 'L'), null)
                    grid.insertBefore(a, null)
                    const b = new TermNode('element', 'div')
                    b.insertBefore(new TermNode('text', 'R'), null)
                    grid.insertBefore(b, null)
                    root.insertBefore(grid, null)
                },
            )
            const l = findChar(buffer, 'L')!
            const r = findChar(buffer, 'R')!
            assert.equal(l.col, 0)
            assert.equal(r.col, 10) // 50% of 20 = 10
        })
    })

    describe('gap in grid', () => {

        it('adds gap between grid cells', () => {
            const { buffer } = render(
                '.grid{display:grid;grid-template-columns:5cell 5cell;gap:2cell}',
                (root) => {
                    const grid = new TermNode('element', 'div')
                    grid.attributes.set('class', 'grid')
                    for (const label of ['A', 'B', 'C', 'D']) {
                        const child = new TermNode('element', 'div')
                        child.insertBefore(new TermNode('text', label), null)
                        grid.insertBefore(child, null)
                    }
                    root.insertBefore(grid, null)
                },
            )
            const a = findChar(buffer, 'A')!
            const b = findChar(buffer, 'B')!
            const c = findChar(buffer, 'C')!
            assert.equal(b.col, 7) // 5 + 2 gap
            assert.equal(c.row, 3) // row height 1 + 2 gap
        })
    })

    describe('fr unit', () => {

        it('1fr 1fr splits available space equally', () => {
            const { buffer } = render(
                '.grid{display:grid;grid-template-columns:1fr 1fr;width:20cell}',
                (root) => {
                    const grid = new TermNode('element', 'div')
                    grid.attributes.set('class', 'grid')
                    const a = new TermNode('element', 'div')
                    a.insertBefore(new TermNode('text', 'L'), null)
                    grid.insertBefore(a, null)
                    const b = new TermNode('element', 'div')
                    b.insertBefore(new TermNode('text', 'R'), null)
                    grid.insertBefore(b, null)
                    root.insertBefore(grid, null)
                },
            )
            const l = findChar(buffer, 'L')!
            const r = findChar(buffer, 'R')!
            assert.equal(l.col, 0)
            assert.equal(r.col, 10) // 20 / 2 = 10 each
        })

        it('1fr 2fr splits 1:2', () => {
            const { buffer } = render(
                '.grid{display:grid;grid-template-columns:1fr 2fr;width:30cell}',
                (root) => {
                    const grid = new TermNode('element', 'div')
                    grid.attributes.set('class', 'grid')
                    const a = new TermNode('element', 'div')
                    a.insertBefore(new TermNode('text', 'A'), null)
                    grid.insertBefore(a, null)
                    const b = new TermNode('element', 'div')
                    b.insertBefore(new TermNode('text', 'B'), null)
                    grid.insertBefore(b, null)
                    root.insertBefore(grid, null)
                },
            )
            const a = findChar(buffer, 'A')!
            const bPos = findChar(buffer, 'B')!
            assert.equal(a.col, 0)
            assert.equal(bPos.col, 10) // 30 * 1/3 = 10
        })
    })
})
