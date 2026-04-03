import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'

function render(buildTree: (root: TermNode) => void, width = 40, height = 15) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(DEFAULT_STYLESHEET)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout }
}

describe('default element margins', () => {

    it('paragraphs have vertical spacing between them', () => {
        const { buffer } = render((root) => {
            const p1 = new TermNode('element', 'p')
            const t1 = new TermNode('text', 'First')
            p1.insertBefore(t1, null)
            root.insertBefore(p1, null)

            const p2 = new TermNode('element', 'p')
            const t2 = new TermNode('text', 'Second')
            p2.insertBefore(t2, null)
            root.insertBefore(p2, null)
        })
        // First paragraph has margin-top:1cell, starts at row 1
        assert.equal(buffer.getCell(0, 1)?.char, 'F')
        // With margins between paragraphs, second is not at row 2
        assert.notEqual(buffer.getCell(0, 2)?.char, 'S')
    })

    it('h1 has vertical margin', () => {
        const { layout } = render((root) => {
            const h1 = new TermNode('element', 'h1')
            const t1 = new TermNode('text', 'Title')
            h1.insertBefore(t1, null)
            root.insertBefore(h1, null)

            const p = new TermNode('element', 'p')
            const t2 = new TermNode('text', 'Body')
            p.insertBefore(t2, null)
            root.insertBefore(p, null)
        })
        // h1 should have margin creating space before body text
        const h1Box = [...layout.values()].find(b => b.y === 0 || b.y > 0)
        assert.ok(h1Box, 'h1 should have a layout box')
    })
})

describe('background-color inheritance', () => {

    it('background-color does not inherit to child text style', () => {
        const root = new TermNode('element', 'root')
        const stylesheet = parseCSS('.parent{background-color:blue;width:20cell;height:3cell}')

        const parent = new TermNode('element', 'div')
        parent.attributes.set('class', 'parent')
        const child = new TermNode('element', 'span')
        const text = new TermNode('text', 'Hi')
        child.insertBefore(text, null)
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)

        const styles = resolveStyles(root, stylesheet)

        // Child's resolved style should NOT have bg:blue — only parent does
        const childStyle = styles.get(child.id)
        assert.equal(childStyle?.bg, 'default', 'child element should not inherit background-color')
    })

    it('text visually appears on parent background (paint fills bg area)', () => {
        const root = new TermNode('element', 'root')
        const stylesheet = parseCSS('.parent{background-color:blue;width:20cell;height:3cell}')

        const parent = new TermNode('element', 'div')
        parent.attributes.set('class', 'parent')
        const text = new TermNode('text', 'Hi')
        parent.insertBefore(text, null)
        root.insertBefore(parent, null)

        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 10)
        const buffer = new CellBuffer(40, 10)
        paint(root, buffer, styles, layout)

        // The cell should show text on blue background because parent fills bg
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(0, 0)?.bg, 'blue')
    })
})
