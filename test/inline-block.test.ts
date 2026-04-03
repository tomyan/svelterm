import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 10) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout }
}

describe('display: inline-block', () => {

    it('flows inline like inline elements', () => {
        const { buffer } = render(
            '.badge{display:inline-block;width:5cell;height:1cell;background-color:blue}',
            (root) => {
                const p = new TermNode('element', 'p')
                const t1 = new TermNode('text', 'Hi ')
                p.insertBefore(t1, null)

                const badge = new TermNode('element', 'span')
                badge.attributes.set('class', 'badge')
                const t2 = new TermNode('text', 'NEW')
                badge.insertBefore(t2, null)
                p.insertBefore(badge, null)

                root.insertBefore(p, null)
            },
        )
        // "Hi " and badge should be on the same row
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(3, 0)?.char, 'N')
        assert.equal(buffer.getCell(3, 0)?.bg, 'blue')
    })

    it('respects explicit width and height', () => {
        const { layout } = render(
            '.box{display:inline-block;width:10cell;height:3cell}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            },
        )
        const boxLayout = [...layout.values()].find(b => b.width === 10 && b.height === 3)
        assert.ok(boxLayout, 'inline-block should respect explicit dimensions')
    })

    it('two inline-blocks sit side by side', () => {
        const { buffer } = render(
            '.ib{display:inline-block;width:5cell;height:1cell}',
            (root) => {
                const p = new TermNode('element', 'p')
                const a = new TermNode('element', 'div')
                a.attributes.set('class', 'ib')
                const ta = new TermNode('text', 'AAA')
                a.insertBefore(ta, null)
                p.insertBefore(a, null)

                const b = new TermNode('element', 'div')
                b.attributes.set('class', 'ib')
                const tb = new TermNode('text', 'BBB')
                b.insertBefore(tb, null)
                p.insertBefore(b, null)

                root.insertBefore(p, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.char, 'A')
        assert.equal(buffer.getCell(5, 0)?.char, 'B')
    })
})
