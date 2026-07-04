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

describe('grid-template-areas and grid-area', () => {

    it('places children into their named areas', () => {
        const { buffer } = renderGrid(
            `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 2cell 2cell;
                     grid-template-areas: "side main" "side main"; }
             .side { grid-area: side; }
             .main { grid-area: main; }`,
            [{ label: 'M', class: 'main' }, { label: 'S', class: 'side' }],
        )
        assert.deepEqual(findChar(buffer, 'S'), { col: 0, row: 0 })
        assert.deepEqual(findChar(buffer, 'M'), { col: 10, row: 0 })
    })

    it('spans columns when an area repeats horizontally', () => {
        const { layout, nodes } = renderGrid(
            `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 1cell 2cell;
                     grid-template-areas: "header header" "nav main"; }
             .header { grid-area: header; }
             .nav { grid-area: nav; }
             .main { grid-area: main; }`,
            [{ label: 'H', class: 'header' }, { label: 'N', class: 'nav' }, { label: 'M', class: 'main' }],
        )
        assert.equal(layout.get(nodes[0].id)?.width, 20)
        assert.equal(layout.get(nodes[0].id)?.y, 0)
        assert.equal(layout.get(nodes[1].id)?.y, 1)
    })

    it('spans rows when an area repeats vertically', () => {
        const { layout, nodes } = renderGrid(
            `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 2cell 3cell;
                     grid-template-areas: "nav main" "nav footer"; }
             .nav { grid-area: nav; }`,
            [{ label: 'N', class: 'nav' }, { label: 'M' }, { label: 'F' }],
        )
        assert.equal(layout.get(nodes[0].id)?.height, 5)
    })

    it('divides width evenly when no column template is given', () => {
        const { buffer } = renderGrid(
            `.grid { display: grid; grid-template-areas: "a b"; }
             .a { grid-area: a; }
             .b { grid-area: b; }`,
            [{ label: 'A', class: 'a' }, { label: 'B', class: 'b' }],
        )
        assert.deepEqual(findChar(buffer, 'A'), { col: 0, row: 0 })
        assert.deepEqual(findChar(buffer, 'B'), { col: 20, row: 0 })
    })

    it('supports numeric grid-area as row/col start and end lines', () => {
        const { buffer, layout, nodes } = renderGrid(
            `.grid { display: grid; grid-template-columns: 10cell 10cell; grid-template-rows: 2cell 2cell; }
             .place { grid-area: 2 / 2 / 3 / 3; }`,
            [{ label: 'A', class: 'place' }, { label: 'B' }],
        )
        assert.deepEqual(findChar(buffer, 'A'), { col: 10, row: 2 })
        assert.equal(layout.get(nodes[0].id)?.height, 2)
    })
})
