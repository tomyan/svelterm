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

describe('margin', () => {

    it('margin-top pushes element down', () => {
        const { layout } = render('.box{margin-top:3cell}', (root) => {
            const box = new TermNode('element', 'div')
            box.attributes.set('class', 'box')
            const text = new TermNode('text', 'Hi')
            box.insertBefore(text, null)
            root.insertBefore(box, null)
        })
        const box = [...layout.values()].find(b => b.y === 3)
        assert.ok(box, 'element should be at y=3')
    })

    it('margin-left pushes element right', () => {
        const { layout } = render('.box{margin-left:5cell}', (root) => {
            const box = new TermNode('element', 'div')
            box.attributes.set('class', 'box')
            const text = new TermNode('text', 'Hi')
            box.insertBefore(text, null)
            root.insertBefore(box, null)
        })
        const box = [...layout.values()].find(b => b.x === 5)
        assert.ok(box, 'element should be at x=5')
    })

    it('margin between siblings in column layout', () => {
        const { buffer } = render('.b{margin-top:2cell}', (root) => {
            const a = new TermNode('element', 'div')
            const aText = new TermNode('text', 'AAA')
            a.insertBefore(aText, null)
            root.insertBefore(a, null)

            const b = new TermNode('element', 'div')
            b.attributes.set('class', 'b')
            const bText = new TermNode('text', 'BBB')
            b.insertBefore(bText, null)
            root.insertBefore(b, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'A')
        assert.equal(buffer.getCell(0, 1)?.char, ' ') // gap
        assert.equal(buffer.getCell(0, 2)?.char, ' ') // gap
        assert.equal(buffer.getCell(0, 3)?.char, 'B') // margin-top:2 pushes B down
    })

    it('margin shorthand with one value', () => {
        const { layout } = render('.box{margin:2cell}', (root) => {
            const box = new TermNode('element', 'div')
            box.attributes.set('class', 'box')
            const text = new TermNode('text', 'Hi')
            box.insertBefore(text, null)
            root.insertBefore(box, null)
        })
        const box = [...layout.values()].find(b => b.x === 2 && b.y === 2)
        assert.ok(box, 'element should be offset by margin on all sides')
    })

    it('margin in row layout pushes siblings apart', () => {
        const { buffer } = render(
            '.container{display:flex;flex-direction:row}.b{margin-left:3cell}',
            (root) => {
                const container = new TermNode('element', 'div')
                container.attributes.set('class', 'container')

                const a = new TermNode('element', 'div')
                const aText = new TermNode('text', 'AA')
                a.insertBefore(aText, null)
                container.insertBefore(a, null)

                const b = new TermNode('element', 'div')
                b.attributes.set('class', 'b')
                const bText = new TermNode('text', 'BB')
                b.insertBefore(bText, null)
                container.insertBefore(b, null)

                root.insertBefore(container, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.char, 'A')
        assert.equal(buffer.getCell(1, 0)?.char, 'A')
        assert.equal(buffer.getCell(2, 0)?.char, ' ') // gap
        assert.equal(buffer.getCell(3, 0)?.char, ' ') // gap
        assert.equal(buffer.getCell(4, 0)?.char, ' ') // gap
        assert.equal(buffer.getCell(5, 0)?.char, 'B') // margin-left:3
    })
})
