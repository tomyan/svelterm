import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'

function el(tag: string, cls?: string, ...children: TermNode[]): TermNode {
    const node = new TermNode('element', tag)
    if (cls) node.attributes.set('class', cls)
    for (const child of children) node.insertBefore(child, null)
    return node
}
const text = (t: string) => new TermNode('text', t)

function scene(root: TermNode, css: string, width = 30, height = 10) {
    const styles = resolveStyles(root, parseCSS(DEFAULT_STYLESHEET + css))
    const layout = computeLayout(root, styles, width, height)
    return { styles, layout }
}

function paintedText(root: TermNode, css: string, width = 30, height = 10): string[] {
    const { styles, layout } = scene(root, css, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    const rows: string[] = []
    for (let y = 0; y < height; y++) {
        let line = ''
        for (let x = 0; x < width; x++) line += buffer.getCell(x, y)?.char ?? ' '
        rows.push(line.replace(/\s+$/, ''))
    }
    return rows
}

describe('grid-auto-flow: column', () => {

    it('fills down each column before moving right', () => {
        // Given: 2 explicit rows, 4 items — a,b fill col 0; c,d col 1
        const items = ['a', 'b', 'c', 'd'].map(t => el('div', 'item', text(t)))
        const grid = el('div', 'grid', ...items)
        const root = el('root', undefined, grid)

        // When
        const { layout } = scene(root, `
            .grid { display: grid; grid-template-rows: 1cell 1cell;
                    grid-template-columns: 5cell 5cell; grid-auto-flow: column; }
        `)

        // Then
        const [a, b, c, d] = items.map(i => layout.get(i.id)!)
        assert.deepEqual([a.x, a.y], [0, 0])
        assert.deepEqual([b.x, b.y], [0, 1])
        assert.deepEqual([c.x, c.y], [5, 0])
        assert.deepEqual([d.x, d.y], [5, 1])
    })
})

describe('minmax() fractional minimums redistribute', () => {

    it('clamping one track to its minimum shrinks the others', () => {
        // Given: 20 cells across minmax(12cell, 1fr) 1fr — naive fr split
        // gives 10/10, violating the 12 minimum; correct: 12 and 8.
        const a = el('div', 'a', text('A'))
        const b = el('div', 'b', text('B'))
        const grid = el('div', 'grid', a, b)
        const root = el('root', undefined, grid)

        // When
        const { layout } = scene(root, `
            .grid { display: grid; grid-template-columns: minmax(12cell, 1fr) 1fr; width: 20cell; }
        `, 20)

        // Then
        assert.equal(layout.get(a.id)!.width, 12)
        assert.equal(layout.get(b.id)!.width, 8)
        assert.equal(layout.get(b.id)!.x, 12)
    })
})

describe('pseudo-elements in table-internal boxes', () => {

    it('::before on a table cell renders', () => {
        // Given
        const cell = el('td', 'cell', text('X'))
        const row = el('tr', undefined, cell)
        const table = el('table', undefined, row)
        const root = el('root', undefined, table)

        // When
        const rows = paintedText(root, `
            .cell::before { content: ">> "; }
        `)

        // Then
        assert.ok(rows.some(r => r.includes('>> X')), `rows: ${JSON.stringify(rows.slice(0, 3))}`)
    })

    it('::before on a table row becomes an anonymous leading cell', () => {
        // Given
        const cell = el('td', undefined, text('X'))
        const row = el('tr', 'row', cell)
        const table = el('table', undefined, row)
        const root = el('root', undefined, table)

        // When
        const rows = paintedText(root, `
            .row::before { content: "R "; }
        `)

        // Then: pseudo content renders before the row's first cell
        assert.ok(rows.some(r => r.includes('R') && r.includes('X') && r.indexOf('R') < r.indexOf('X')),
            `rows: ${JSON.stringify(rows.slice(0, 3))}`)
    })
})

describe('counter() in content', () => {

    it('numbers elements via counter-reset/increment', () => {
        // Given: three sections numbered by ::before
        const sections = [1, 2, 3].map(() => el('div', 'section', text('body')))
        const wrap = el('div', 'wrap', ...sections)
        const root = el('root', undefined, wrap)

        // When
        const rows = paintedText(root, `
            .wrap { counter-reset: sec; }
            .section { counter-increment: sec; }
            .section::before { content: counter(sec) ". "; }
        `)

        // Then
        assert.ok(rows.some(r => r.includes('1. body')), JSON.stringify(rows.slice(0, 4)))
        assert.ok(rows.some(r => r.includes('2. body')))
        assert.ok(rows.some(r => r.includes('3. body')))
    })

    it('counter-reset with a value and increment amounts apply', () => {
        const items = [1, 2].map(() => el('div', 'item', text('x')))
        const wrap = el('div', 'wrap', ...items)
        const root = el('root', undefined, wrap)
        const rows = paintedText(root, `
            .wrap { counter-reset: n 10; }
            .item { counter-increment: n 5; }
            .item::before { content: counter(n) " "; }
        `)
        assert.ok(rows.some(r => r.includes('15 x')), JSON.stringify(rows.slice(0, 3)))
        assert.ok(rows.some(r => r.includes('20 x')))
    })
})
