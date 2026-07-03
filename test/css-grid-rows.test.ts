import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

const WIDTH = 40
const HEIGHT = 12

function renderGrid(css: string, cells: { label: string; class?: string }[]) {
    const root = new TermNode('element', 'root')
    const grid = new TermNode('element', 'div')
    grid.attributes.set('class', 'grid')
    const nodes: TermNode[] = []
    for (const cell of cells) {
        const child = new TermNode('element', 'div')
        if (cell.class) child.attributes.set('class', cell.class)
        child.insertBefore(new TermNode('text', cell.label), null)
        grid.insertBefore(child, null)
        nodes.push(child)
    }
    root.insertBefore(grid, null)

    const stylesheet = parseCSS(css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return { buffer, layout, nodes }
}

function findChar(buffer: CellBuffer, char: string): { col: number; row: number } | null {
    for (let row = 0; row < HEIGHT; row++) {
        for (let col = 0; col < WIDTH; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('grid rows', () => {

    describe('grid-row placement', () => {
        it('places an item in an explicit row', () => {
            const { buffer } = renderGrid(
                `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 2cell 2cell; }
                 .low { grid-row: 2; }`,
                [{ label: 'A', class: 'low' }, { label: 'B' }],
            )
            assert.deepEqual(findChar(buffer, 'A'), { col: 0, row: 2 })
        })

        it('spans rows with start/end lines', () => {
            const { layout, nodes } = renderGrid(
                `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 2cell 3cell; }
                 .tall { grid-row: 1 / 3; }`,
                [{ label: 'A', class: 'tall' }, { label: 'B' }],
            )
            assert.equal(layout.get(nodes[0].id)?.height, 5)
        })

        it('spans rows with the span keyword', () => {
            const { layout, nodes } = renderGrid(
                `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 2cell 2cell; }
                 .tall { grid-row: span 2; }`,
                [{ label: 'A', class: 'tall' }, { label: 'B' }],
            )
            assert.equal(layout.get(nodes[0].id)?.height, 4)
        })

        it('combines grid-row and grid-column placement', () => {
            const { buffer } = renderGrid(
                `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 2cell 2cell; }
                 .place { grid-row: 2; grid-column: 2; }`,
                [{ label: 'A', class: 'place' }, { label: 'B' }],
            )
            assert.deepEqual(findChar(buffer, 'A'), { col: 10, row: 2 })
        })

        it('respects row gap between explicit rows', () => {
            const { buffer } = renderGrid(
                `.grid { display: grid; grid-template-columns: 10cell; grid-template-rows: 2cell 2cell; gap: 1cell; }
                 .low { grid-row: 2; }`,
                [{ label: 'A', class: 'low' }],
            )
            assert.deepEqual(findChar(buffer, 'A'), { col: 0, row: 3 })
        })
    })

    describe('minmax() track sizing', () => {
        it('gives a minmax fr track the remaining space when above the minimum', () => {
            const { buffer } = renderGrid(
                '.grid { display: grid; grid-template-columns: minmax(10cell, 1fr) 10cell; }',
                [{ label: 'A' }, { label: 'B' }],
            )
            assert.deepEqual(findChar(buffer, 'B'), { col: 30, row: 0 })
        })

        it('enforces the minimum when remaining space is too small', () => {
            const { buffer } = renderGrid(
                '.grid { display: grid; grid-template-columns: minmax(15cell, 1fr) 35cell; }',
                [{ label: 'A' }, { label: 'B' }],
            )
            assert.deepEqual(findChar(buffer, 'B'), { col: 15, row: 0 })
        })

        it('sizes a fixed-max track at its maximum, floored by its minimum', () => {
            const { buffer } = renderGrid(
                '.grid { display: grid; grid-template-columns: minmax(5cell, 12cell) 10cell; }',
                [{ label: 'A' }, { label: 'B' }],
            )
            assert.deepEqual(findChar(buffer, 'B'), { col: 12, row: 0 })
        })

        it('works inside grid-template-rows', () => {
            const { buffer } = renderGrid(
                `.grid { display: grid; grid-template-columns: 10cell; grid-template-rows: minmax(3cell, 4cell) 2cell; }
                 .low { grid-row: 2; }`,
                [{ label: 'A' }, { label: 'B', class: 'low' }],
            )
            assert.deepEqual(findChar(buffer, 'B'), { col: 0, row: 4 })
        })
    })
})
