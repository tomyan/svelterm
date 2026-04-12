import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout, type LayoutBox } from '../src/layout/engine.js'

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

function getBox(boxes: Map<number, LayoutBox>, node: TermNode): LayoutBox {
    const box = boxes.get(node.id)
    if (!box) throw new Error(`No box for node ${node.tag}.${node.attributes.get('class')}`)
    return box
}

describe('CSS Grid - repeat()', () => {

    it('repeat(3, 1fr) creates three equal columns', () => {
        // Given
        const grid = new TermNode('element', 'div')
        const cells: TermNode[] = []
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: repeat(3, 1fr) } .cell { height:1cell }',
            (root) => {
                grid.attributes.set('class', 'grid')
                root.insertBefore(grid, null)
                for (const label of ['A', 'B', 'C']) {
                    cells.push(addElement(grid, 'div', 'cell', label))
                }
            },
            30,
        )

        // Then
        assert.equal(getBox(boxes, cells[0]).width, 10)
        assert.equal(getBox(boxes, cells[1]).width, 10)
        assert.equal(getBox(boxes, cells[2]).width, 10)
    })

    it('repeat(2, 5cell) creates two fixed columns', () => {
        // Given
        const cells: TermNode[] = []
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: repeat(2, 5cell) } .cell { height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                cells.push(addElement(grid, 'div', 'cell', 'A'))
                cells.push(addElement(grid, 'div', 'cell', 'B'))
            },
        )

        // Then
        assert.equal(getBox(boxes, cells[0]).width, 5)
        assert.equal(getBox(boxes, cells[1]).width, 5)
    })

    it('repeat(2, 1fr 2fr) creates four columns with alternating sizes', () => {
        // Given: 1fr 2fr 1fr 2fr in 30 cells = 5 per fr
        const cells: TermNode[] = []
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: repeat(2, 1fr 2fr) } .cell { height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                for (const label of ['A', 'B', 'C', 'D']) {
                    cells.push(addElement(grid, 'div', 'cell', label))
                }
            },
            30,
        )

        // Then
        assert.equal(getBox(boxes, cells[0]).width, 5)   // 1fr
        assert.equal(getBox(boxes, cells[1]).width, 10)  // 2fr
        assert.equal(getBox(boxes, cells[2]).width, 5)   // 1fr
        assert.equal(getBox(boxes, cells[3]).width, 10)  // 2fr
    })

    it('mixed repeat and fixed: 5cell repeat(2, 1fr)', () => {
        // Given: 5cell + 2x1fr sharing remaining 25 cells
        const cells: TermNode[] = []
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: 5cell repeat(2, 1fr) } .cell { height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                for (const label of ['A', 'B', 'C']) {
                    cells.push(addElement(grid, 'div', 'cell', label))
                }
            },
            30,
        )

        // Then
        assert.equal(getBox(boxes, cells[0]).width, 5)
        assert.equal(getBox(boxes, cells[1]).width, 12) // floor(25/2)
        assert.equal(getBox(boxes, cells[2]).width, 12)
    })
})

describe('CSS Grid - item placement', () => {

    it('grid-column: span 2 makes item span two columns', () => {
        // Given
        const cells: TermNode[] = []
        let wide: TermNode
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: 1fr 1fr 1fr } .cell { height:1cell } .wide { grid-column: span 2; height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                cells.push(addElement(grid, 'div', 'cell', 'A'))
                cells.push(addElement(grid, 'div', 'cell', 'B'))
                cells.push(addElement(grid, 'div', 'cell', 'C'))
                wide = addElement(grid, 'div', 'wide', 'W')
                cells.push(addElement(grid, 'div', 'cell', 'D'))
            },
            30,
        )

        // Then: W spans 2 columns = 20 wide
        assert.equal(getBox(boxes, wide!).width, 20)
        // Row 1: A(10) B(10) C(10), Row 2: W(20) D(10)
        assert.equal(getBox(boxes, wide!).y, getBox(boxes, cells[3]).y)
    })

    it('grid-column: 1 / 3 places item from line 1 to line 3', () => {
        // Given
        let placed: TermNode
        let cell: TermNode
        const boxes = layout(
            '.grid { display:grid; grid-template-columns: 1fr 1fr 1fr } .cell { height:1cell } .placed { grid-column: 1 / 3; height:1cell }',
            (root) => {
                const grid = addElement(root, 'div', 'grid')
                placed = addElement(grid, 'div', 'placed', 'P')
                cell = addElement(grid, 'div', 'cell', 'A')
            },
            30,
        )

        // Then: placed spans columns 1-2 (20 wide at x=0)
        const placedBox = getBox(boxes, placed!)
        assert.equal(placedBox.width, 20)
        assert.equal(placedBox.x, 0)
    })
})
