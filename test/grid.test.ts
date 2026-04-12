import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'

function layout(css: string, buildTree: (root: TermNode) => void, width = 40, height = 20) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    return computeLayout(root, styles, width, height)
}

function addElement(parent: TermNode, tag: string, cls: string, text?: string): TermNode {
    const el = new TermNode('element', tag)
    el.attributes.set('class', cls)
    if (text) el.insertBefore(new TermNode('text', text), null)
    parent.insertBefore(el, null)
    return el
}

describe('CSS Grid - repeat()', () => {

    it('repeat(3, 1fr) creates three equal columns', () => {
        // Given: grid with repeat(3, 1fr)
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: repeat(3, 1fr) } .cell { height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                addElement(grid, 'div', 'cell', 'A')
                addElement(grid, 'div', 'cell', 'B')
                addElement(grid, 'div', 'cell', 'C')
            },
            30,
        )

        // Then: three columns of 10 cells each
        const cells = [...boxes.values()].filter(b => b.width > 0 && b.height === 1)
        assert.equal(cells.length, 3, 'should have 3 cells')
        assert.equal(cells[0].width, 10)
        assert.equal(cells[1].width, 10)
        assert.equal(cells[2].width, 10)
    })

    it('repeat(2, 5cell) creates two fixed columns', () => {
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: repeat(2, 5cell) } .cell { height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                addElement(grid, 'div', 'cell', 'A')
                addElement(grid, 'div', 'cell', 'B')
            },
        )

        const cells = [...boxes.values()].filter(b => b.height === 1)
        assert.equal(cells.length, 2)
        assert.equal(cells[0].width, 5)
        assert.equal(cells[1].width, 5)
    })

    it('repeat(2, 1fr 2fr) creates four columns with alternating sizes', () => {
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: repeat(2, 1fr 2fr) } .cell { height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                addElement(grid, 'div', 'cell', 'A')
                addElement(grid, 'div', 'cell', 'B')
                addElement(grid, 'div', 'cell', 'C')
                addElement(grid, 'div', 'cell', 'D')
            },
            30,
        )

        // 1fr+2fr repeated = 1fr 2fr 1fr 2fr, total 6fr in 30 cells = 5 per fr
        const cells = [...boxes.values()].filter(b => b.height === 1)
        assert.equal(cells.length, 4)
        assert.equal(cells[0].width, 5)  // 1fr = 5
        assert.equal(cells[1].width, 10) // 2fr = 10
        assert.equal(cells[2].width, 5)  // 1fr = 5
        assert.equal(cells[3].width, 10) // 2fr = 10
    })

    it('mixed repeat and fixed: 5cell repeat(2, 1fr)', () => {
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: 5cell repeat(2, 1fr) } .cell { height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                addElement(grid, 'div', 'cell', 'A')
                addElement(grid, 'div', 'cell', 'B')
                addElement(grid, 'div', 'cell', 'C')
            },
            30,
        )

        // 5cell fixed + 2x1fr sharing remaining 25 cells
        const cells = [...boxes.values()].filter(b => b.height === 1)
        assert.equal(cells.length, 3)
        assert.equal(cells[0].width, 5)
        assert.equal(cells[1].width, 12) // floor(25/2)
        assert.equal(cells[2].width, 12)
    })
})

describe('CSS Grid - item placement', () => {

    it('grid-column: span 2 makes item span two columns', () => {
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: 1fr 1fr 1fr } .cell { height:1cell } .wide { grid-column: span 2; height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                addElement(grid, 'div', 'cell', 'A')
                addElement(grid, 'div', 'cell', 'B')
                addElement(grid, 'div', 'cell', 'C')
                addElement(grid, 'div', 'wide', 'W')
                addElement(grid, 'div', 'cell', 'D')
            },
            30,
        )

        // Row 1: A(10) B(10) C(10)
        // Row 2: W(20) D(10)
        const cells = [...boxes.values()].filter(b => b.height === 1)
        const wide = cells.find(c => c.width === 20)
        assert.ok(wide, 'should have a 20-wide cell spanning 2 columns')
    })

    it('grid-column: 1 / 3 places item from line 1 to line 3', () => {
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: 1fr 1fr 1fr } .cell { height:1cell } .placed { grid-column: 1 / 3; height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                addElement(grid, 'div', 'placed', 'P')
                addElement(grid, 'div', 'cell', 'A')
            },
            30,
        )

        const cells = [...boxes.values()].filter(b => b.height === 1)
        const placed = cells.find(c => c.width === 20 && c.x === 0)
        assert.ok(placed, 'should have a cell spanning columns 1-2 at x=0')
    })
})
