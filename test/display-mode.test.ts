import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 10) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(DEFAULT_STYLESHEET + '\n' + css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout }
}

describe('display: inline', () => {

    it('inline spans flow horizontally within a block parent', () => {
        const { buffer } = render('', (root) => {
            const p = new TermNode('element', 'p')
            const s1 = new TermNode('element', 'span')
            const t1 = new TermNode('text', 'Hello ')
            s1.insertBefore(t1, null)
            p.insertBefore(s1, null)

            const s2 = new TermNode('element', 'span')
            const t2 = new TermNode('text', 'World')
            s2.insertBefore(t2, null)
            p.insertBefore(s2, null)

            root.insertBefore(p, null)
        })
        // Both spans should be on the same row
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(6, 0)?.char, 'W')
        assert.equal(buffer.getCell(10, 0)?.char, 'd')
    })

    it('mixed inline: Hello <strong>world</strong>!', () => {
        const { buffer } = render('', (root) => {
            const p = new TermNode('element', 'p')

            const t1 = new TermNode('text', 'Hello ')
            p.insertBefore(t1, null)

            const strong = new TermNode('element', 'strong')
            const t2 = new TermNode('text', 'world')
            strong.insertBefore(t2, null)
            p.insertBefore(strong, null)

            const t3 = new TermNode('text', '!')
            p.insertBefore(t3, null)

            root.insertBefore(p, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(6, 0)?.char, 'w')
        assert.equal(buffer.getCell(6, 0)?.bold, true)
        assert.equal(buffer.getCell(11, 0)?.char, '!')
    })
})

describe('display: block', () => {

    it('block divs stack vertically', () => {
        const { buffer } = render('', (root) => {
            const d1 = new TermNode('element', 'div')
            const t1 = new TermNode('text', 'Line 1')
            d1.insertBefore(t1, null)
            root.insertBefore(d1, null)

            const d2 = new TermNode('element', 'div')
            const t2 = new TermNode('text', 'Line 2')
            d2.insertBefore(t2, null)
            root.insertBefore(d2, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'L') // Line 1
        assert.equal(buffer.getCell(5, 0)?.char, '1')
        assert.equal(buffer.getCell(0, 1)?.char, 'L') // Line 2
        assert.equal(buffer.getCell(5, 1)?.char, '2')
    })

    it('paragraphs are block elements', () => {
        const { buffer } = render('', (root) => {
            const p1 = new TermNode('element', 'p')
            const t1 = new TermNode('text', 'Para 1')
            p1.insertBefore(t1, null)
            root.insertBefore(p1, null)

            const p2 = new TermNode('element', 'p')
            const t2 = new TermNode('text', 'Para 2')
            p2.insertBefore(t2, null)
            root.insertBefore(p2, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'P') // Para 1
        assert.equal(buffer.getCell(0, 1)?.char, 'P') // Para 2
    })
})

describe('display: flex (opt-in)', () => {

    it('display:flex with flex-direction:row overrides block default', () => {
        const { buffer } = render('.row{display:flex;flex-direction:row;gap:1cell}', (root) => {
            const row = new TermNode('element', 'div')
            row.attributes.set('class', 'row')

            const d1 = new TermNode('element', 'div')
            const t1 = new TermNode('text', 'A')
            d1.insertBefore(t1, null)
            row.insertBefore(d1, null)

            const d2 = new TermNode('element', 'div')
            const t2 = new TermNode('text', 'B')
            d2.insertBefore(t2, null)
            row.insertBefore(d2, null)

            root.insertBefore(row, null)
        })
        // With flex row, divs should be side by side
        assert.equal(buffer.getCell(0, 0)?.char, 'A')
        assert.equal(buffer.getCell(2, 0)?.char, 'B')
    })
})

describe('display: table', () => {

    it('table renders rows and cells in a grid', () => {
        const { buffer } = render('', (root) => {
            const table = new TermNode('element', 'table')
            const tr1 = new TermNode('element', 'tr')
            const td1a = new TermNode('element', 'td')
            const t1a = new TermNode('text', 'Name')
            td1a.insertBefore(t1a, null)
            tr1.insertBefore(td1a, null)
            const td1b = new TermNode('element', 'td')
            const t1b = new TermNode('text', 'Age')
            td1b.insertBefore(t1b, null)
            tr1.insertBefore(td1b, null)
            table.insertBefore(tr1, null)

            const tr2 = new TermNode('element', 'tr')
            const td2a = new TermNode('element', 'td')
            const t2a = new TermNode('text', 'Alice')
            td2a.insertBefore(t2a, null)
            tr2.insertBefore(td2a, null)
            const td2b = new TermNode('element', 'td')
            const t2b = new TermNode('text', '30')
            td2b.insertBefore(t2b, null)
            tr2.insertBefore(td2b, null)
            table.insertBefore(tr2, null)

            root.insertBefore(table, null)
        })
        // Row 0: "Name" and "Age" side by side with spacing
        assert.equal(buffer.getCell(0, 0)?.char, 'N') // Name
        // Row 1: "Alice" and "30" side by side
        assert.equal(buffer.getCell(0, 1)?.char, 'A') // Alice
        // Columns should be aligned — Age and 30 start at same column
        // Find where "Age" starts (after "Name" + padding)
        let ageCol = -1
        for (let c = 4; c < 20; c++) {
            if (buffer.getCell(c, 0)?.char === 'A') { ageCol = c; break }
        }
        assert.ok(ageCol > 0, 'Age column found')
        // "30" should start at the same column
        assert.equal(buffer.getCell(ageCol, 1)?.char, '3')
    })
})
