import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'

function render(buildTree: (root: TermNode) => void, extraCSS = '', width = 40, height = 10) {
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

describe('default element styles', () => {

    it('h1 renders bold', () => {
        const buffer = render((root) => {
            const h1 = new TermNode('element', 'h1')
            const text = new TermNode('text', 'Title')
            h1.insertBefore(text, null)
            root.insertBefore(h1, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'T')
        assert.equal(buffer.getCell(0, 0)?.bold, true)
    })

    it('h2 renders bold', () => {
        const buffer = render((root) => {
            const h2 = new TermNode('element', 'h2')
            const text = new TermNode('text', 'Subtitle')
            h2.insertBefore(text, null)
            root.insertBefore(h2, null)
        })
        assert.equal(buffer.getCell(0, 0)?.bold, true)
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
        assert.equal(buffer.getCell(0, 0)?.bold, true)
    })

    it('em renders italic', () => {
        const buffer = render((root) => {
            const em = new TermNode('element', 'em')
            const text = new TermNode('text', 'Italic')
            em.insertBefore(text, null)
            root.insertBefore(em, null)
        })
        assert.equal(buffer.getCell(0, 0)?.italic, true)
    })

    it('code renders with distinct color', () => {
        const buffer = render((root) => {
            const code = new TermNode('element', 'code')
            const text = new TermNode('text', 'x = 1')
            code.insertBefore(text, null)
            root.insertBefore(code, null)
        })
        const cell = buffer.getCell(0, 0)!
        assert.ok(cell.fg !== 'default', 'code should have non-default fg color')
    })

    it('a renders with underline', () => {
        const buffer = render((root) => {
            const a = new TermNode('element', 'a')
            const text = new TermNode('text', 'Link')
            a.insertBefore(text, null)
            root.insertBefore(a, null)
        })
        assert.equal(buffer.getCell(0, 0)?.underline, true)
    })

    it('hr renders as horizontal line', () => {
        const buffer = render((root) => {
            const hr = new TermNode('element', 'hr')
            root.insertBefore(hr, null)
        }, '', 20, 5)
        // hr should render as ─ characters across the width
        assert.equal(buffer.getCell(0, 0)?.char, '─')
        assert.equal(buffer.getCell(10, 0)?.char, '─')
    })

    it('p is a block element', () => {
        const buffer = render((root) => {
            const p1 = new TermNode('element', 'p')
            const t1 = new TermNode('text', 'Para 1')
            p1.insertBefore(t1, null)
            root.insertBefore(p1, null)

            const p2 = new TermNode('element', 'p')
            const t2 = new TermNode('text', 'Para 2')
            p2.insertBefore(t2, null)
            root.insertBefore(p2, null)
        })
        // Paragraphs stack vertically
        assert.equal(buffer.getCell(0, 0)?.char, 'P') // Para 1
        assert.equal(buffer.getCell(0, 1)?.char, 'P') // Para 2
    })
})
