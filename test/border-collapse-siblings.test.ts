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

function paintedText(root: TermNode, css: string, width = 24, height = 10): string[] {
    const styles = resolveStyles(root, parseCSS(DEFAULT_STYLESHEET + css))
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    const rows: string[] = []
    for (let y = 0; y < height; y++) {
        let line = ''
        for (let x = 0; x < width; x++) line += buffer.getCell(x, y)?.char ?? ' '
        rows.push(line.replace(/\s+$/, ''))
    }
    return rows.filter(r => r !== '')
}

// With border-collapse: collapse on the container (inherited, so :root
// works too), adjacent bordered siblings share a single border line with
// junction glyphs — an opt-in cell-grid extension of the CSS table
// property to all boxes. Without it, frames stay separate as in browsers.
describe('adjacent sibling borders collapse into shared lines', () => {

    it('stacked blocks share a ├──┤ divider', () => {
        // Given
        const root = el('root', undefined,
            el('div', 'box', text('one')), el('div', 'box', text('two')))

        // When
        const rows = paintedText(root, 'root { border-collapse: collapse; } .box { border: single; width: 10cell; }')

        // Then: one shared divider, not two abutting edges
        assert.deepEqual(rows, [
            '┌────────┐',
            '│one     │',
            '├────────┤',
            '│two     │',
            '└────────┘',
        ])
    })

    it('flex-row siblings share a ┬──┴ divider', () => {
        // Given
        const row = el('div', 'row', el('div', 'box', text('a')), el('div', 'box', text('b')))
        const root = el('root', undefined, row)

        // When
        const rows = paintedText(root,
            '.row { display: flex; border-collapse: collapse; } .box { border: single; width: 6cell; height: 3cell; }')

        // Then
        assert.deepEqual(rows, [
            '┌────┬────┐',
            '│a   │b   │',
            '└────┴────┘',
        ])
    })

    it('flex-column siblings share a divider', () => {
        const col = el('div', 'col', el('div', 'box', text('a')), el('div', 'box', text('b')))
        const root = el('root', undefined, col)
        const rows = paintedText(root,
            '.col { display: flex; flex-direction: column; border-collapse: collapse; } .box { border: single; width: 8cell; }')
        assert.deepEqual(rows, [
            '┌──────┐',
            '│a     │',
            '├──────┤',
            '│b     │',
            '└──────┘',
        ])
    })

    it('a 2x2 bordered grid meets in a ┼ cross', () => {
        const grid = el('div', 'grid',
            el('div', 'box', text('a')), el('div', 'box', text('b')),
            el('div', 'box', text('c')), el('div', 'box', text('d')))
        const root = el('root', undefined, grid)
        const rows = paintedText(root,
            '.grid { display: grid; grid-template-columns: 8cell 8cell; border-collapse: collapse; } .box { border: single; }')
        assert.deepEqual(rows, [
            '┌──────┬──────┐',
            '│a     │b     │',
            '├──────┼──────┤',
            '│c     │d     │',
            '└──────┴──────┘',
        ])
    })

    it('junctions use the border family — heavy gives ┣━━┫', () => {
        const root = el('root', undefined,
            el('div', 'box', text('a')), el('div', 'box', text('b')))
        const rows = paintedText(root, 'root { border-collapse: collapse; } .box { border: heavy; width: 8cell; }')
        assert.deepEqual(rows, [
            '┏━━━━━━┓',
            '┃a     ┃',
            '┣━━━━━━┫',
            '┃b     ┃',
            '┗━━━━━━┛',
        ])
    })

    it('without border-collapse, sibling frames stay separate (the default)', () => {
        // Given
        const root = el('root', undefined,
            el('div', 'box', text('a')), el('div', 'box', text('b')))

        // When: no border-collapse anywhere
        const rows = paintedText(root, '.box { border: single; width: 8cell; }')

        // Then: two full frames, no shared line
        assert.deepEqual(rows, [
            '┌──────┐',
            '│a     │',
            '└──────┘',
            '┌──────┐',
            '│b     │',
            '└──────┘',
        ])
    })

    it('border-collapse: separate on a child opts it back out', () => {
        // Given: root opts in, but the second box reverts to separate
        const root = el('root', undefined,
            el('div', 'box', text('a')), el('div', 'box sep', text('b')))

        // When
        const rows = paintedText(root,
            'root { border-collapse: collapse; } .box { border: single; width: 8cell; } .sep { border-collapse: separate; }')

        // Then
        assert.deepEqual(rows, [
            '┌──────┐',
            '│a     │',
            '└──────┘',
            '┌──────┐',
            '│b     │',
            '└──────┘',
        ])
    })

    it('an unbordered sibling breaks the collapse', () => {
        // Given: middle box has no border — the outer boxes keep full
        // separate frames (no overlap, no junctions)
        const root = el('root', undefined,
            el('div', 'box', text('a')),
            el('div', 'plain', text('mid')),
            el('div', 'box', text('b')))

        // When
        const rows = paintedText(root, 'root { border-collapse: collapse; } .box { border: single; width: 8cell; }')

        // Then
        assert.deepEqual(rows, [
            '┌──────┐',
            '│a     │',
            '└──────┘',
            'mid',
            '┌──────┐',
            '│b     │',
            '└──────┘',
        ])
    })
})
