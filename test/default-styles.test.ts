import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'

function render(buildTree: (root: TermNode) => void, extraCSS = '', width = 40, height = 15) {
    const root = new TermNode('element', 'root')
    const fullCSS = DEFAULT_STYLESHEET + '\n' + extraCSS
    const stylesheet = parseCSS(fullCSS)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

function findChar(buffer: CellBuffer, char: string, w = 40, h = 15): { col: number; row: number } | null {
    for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('default element styles', () => {

    it('h1 renders bold', () => {
        const buffer = render((root) => {
            const h1 = new TermNode('element', 'h1')
            const text = new TermNode('text', 'Title')
            h1.insertBefore(text, null)
            root.insertBefore(h1, null)
        })
        const pos = findChar(buffer, 'T')!
        assert.ok(pos, 'T should be found')
        assert.equal(buffer.getCell(pos.col, pos.row)?.bold, true)
    })

    it('h2 renders bold', () => {
        const buffer = render((root) => {
            const h2 = new TermNode('element', 'h2')
            const text = new TermNode('text', 'Sub')
            h2.insertBefore(text, null)
            root.insertBefore(h2, null)
        })
        const pos = findChar(buffer, 'S')!
        assert.ok(pos)
        assert.equal(buffer.getCell(pos.col, pos.row)?.bold, true)
    })

    it('strong renders bold', () => {
        const buffer = render((root) => {
            const p = new TermNode('element', 'p')
            const strong = new TermNode('element', 'strong')
            const text = new TermNode('text', 'Bold')
            strong.insertBefore(text, null)
            p.insertBefore(strong, null)
            root.insertBefore(p, null)
        })
        const pos = findChar(buffer, 'B')!
        assert.ok(pos)
        assert.equal(buffer.getCell(pos.col, pos.row)?.bold, true)
    })

    it('em renders italic', () => {
        const buffer = render((root) => {
            const em = new TermNode('element', 'em')
            const text = new TermNode('text', 'Italic')
            em.insertBefore(text, null)
            root.insertBefore(em, null)
        })
        const pos = findChar(buffer, 'I')!
        assert.ok(pos)
        assert.equal(buffer.getCell(pos.col, pos.row)?.italic, true)
    })

    it('code renders with distinct color', () => {
        const buffer = render((root) => {
            const code = new TermNode('element', 'code')
            const text = new TermNode('text', 'x = 1')
            code.insertBefore(text, null)
            root.insertBefore(code, null)
        })
        const pos = findChar(buffer, 'x')!
        assert.ok(pos)
        assert.ok(buffer.getCell(pos.col, pos.row)?.fg !== 'default', 'code should have non-default fg color')
    })

    it('a renders with underline', () => {
        const buffer = render((root) => {
            const a = new TermNode('element', 'a')
            const text = new TermNode('text', 'Link')
            a.insertBefore(text, null)
            root.insertBefore(a, null)
        })
        const pos = findChar(buffer, 'L')!
        assert.ok(pos)
        assert.equal(buffer.getCell(pos.col, pos.row)?.underline, true)
    })

    it('hr renders as horizontal line', () => {
        const buffer = render((root) => {
            const hr = new TermNode('element', 'hr')
            root.insertBefore(hr, null)
        }, '', 20, 10)
        const pos = findChar(buffer, '─', 20, 10)
        assert.ok(pos, 'hr should render ─ characters')
    })

    it('ul > li renders with bullet marker', () => {
        const buffer = render((root) => {
            const ul = new TermNode('element', 'ul')
            const li1 = new TermNode('element', 'li')
            const t1 = new TermNode('text', 'First')
            li1.insertBefore(t1, null)
            ul.insertBefore(li1, null)
            root.insertBefore(ul, null)
        })
        const bullet = findChar(buffer, '•')
        assert.ok(bullet, 'bullet marker should be found')
        const f = findChar(buffer, 'F')
        assert.ok(f, 'text should be found')
        assert.equal(f!.row, bullet!.row, 'bullet and text on same row')
    })

    it('ol > li renders with number marker', () => {
        const buffer = render((root) => {
            const ol = new TermNode('element', 'ol')
            const li1 = new TermNode('element', 'li')
            const t1 = new TermNode('text', 'First')
            li1.insertBefore(t1, null)
            ol.insertBefore(li1, null)
            root.insertBefore(ol, null)
        })
        const num = findChar(buffer, '1')
        assert.ok(num, 'number marker should be found')
        const dot = findChar(buffer, '.')
        assert.ok(dot, 'dot should be found')
    })

    it('p is a block element', () => {
        const buffer = render((root) => {
            const p1 = new TermNode('element', 'p')
            const t1 = new TermNode('text', 'Alpha')
            p1.insertBefore(t1, null)
            root.insertBefore(p1, null)

            const p2 = new TermNode('element', 'p')
            const t2 = new TermNode('text', 'Beta')
            p2.insertBefore(t2, null)
            root.insertBefore(p2, null)
        })
        const a = findChar(buffer, 'A')!
        const b = findChar(buffer, 'B')!
        assert.ok(a && b)
        assert.ok(b.row > a.row, 'paragraphs should stack vertically')
    })
})
