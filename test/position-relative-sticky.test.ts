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

function layoutOf(root: TermNode, css: string, width = 20, height = 12) {
    const styles = resolveStyles(root, parseCSS(DEFAULT_STYLESHEET + css))
    const layout = computeLayout(root, styles, width, height)
    return { styles, layout }
}

describe('position: relative', () => {

    it('shifts the box by top/left without moving following flow', () => {
        // Given
        const shifted = el('div', 'shifted', text('a'))
        const after = el('div', 'after', text('b'))
        const root = el('root', undefined, shifted, after)

        // When
        const { layout } = layoutOf(root, `
            .shifted { position: relative; top: 2cell; left: 3cell; height: 1cell; }
            .after { height: 1cell; }
        `)

        // Then: shifted box moves; the next sibling stays where flow put it
        const s = layout.get(shifted.id)!
        const a = layout.get(after.id)!
        assert.equal(s.y, 2)
        assert.equal(s.x, 3)
        assert.equal(a.y, 1, 'flow position of following sibling must ignore the shift')
    })

    it('right/bottom shift negatively when left/top are unset', () => {
        // Given
        const shifted = el('div', 'shifted', text('a'))
        const root = el('root', undefined, el('div', 'spacer'), shifted)

        // When
        const { layout } = layoutOf(root, `
            .spacer { height: 4cell; }
            .shifted { position: relative; bottom: 2cell; right: 1cell; height: 1cell; }
        `)

        // Then: bottom:2 moves it up 2 from flow y=4; right:1 moves left
        const s = layout.get(shifted.id)!
        assert.equal(s.y, 2)
        assert.equal(s.x, -1)
    })

    it('descendants move with the shifted element', () => {
        // Given
        const child = el('span', 'child', text('x'))
        const shifted = el('div', 'shifted', child)
        const root = el('root', undefined, shifted)

        // When
        const { layout } = layoutOf(root, `
            .shifted { position: relative; top: 3cell; }
        `)

        // Then
        assert.equal(layout.get(child.id)!.y, 3)
    })

    it('left wins over right when both are set', () => {
        const shifted = el('div', 'shifted', text('a'))
        const root = el('root', undefined, shifted)
        const { layout } = layoutOf(root, `
            .shifted { position: relative; left: 2cell; right: 5cell; }
        `)
        assert.equal(layout.get(shifted.id)!.x, 2)
    })
})

describe('position: sticky (top)', () => {

    function stickyScene(scrollTop: number) {
        const header = el('div', 'header', text('HEAD'))
        const rows: TermNode[] = [header]
        for (let i = 0; i < 20; i++) rows.push(el('div', 'row', text(`row ${i}`)))
        const scroller = el('div', 'scroller', ...rows)
        scroller.scrollTop = scrollTop
        const root = el('root', undefined, scroller)
        const { styles, layout } = layoutOf(root, `
            .scroller { height: 6cell; overflow: auto; }
            .header { position: sticky; top: 0; height: 1cell; background: #223344; }
            .row { height: 1cell; }
        `)
        const buffer = new CellBuffer(20, 12)
        paint(root, buffer, styles, layout)
        return buffer
    }

    function rowText(buffer: CellBuffer, row: number): string {
        let out = ''
        for (let col = 0; col < buffer.width; col++) out += buffer.getCell(col, row)?.char ?? ' '
        return out.trim()
    }

    it('paints in flow position when not scrolled', () => {
        const buffer = stickyScene(0)
        assert.equal(rowText(buffer, 0), 'HEAD')
        assert.equal(rowText(buffer, 1), 'row 0')
    })

    it('sticks to the container top when scrolled past', () => {
        // When: scrolled 5 rows — the header would be off-screen at y=-5
        const buffer = stickyScene(5)

        // Then: header stuck at container top; scrolled rows continue below
        assert.equal(rowText(buffer, 0), 'HEAD')
        assert.equal(rowText(buffer, 1), 'row 5')
    })
})
