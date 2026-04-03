import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 20, height = 5) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe('text-align', () => {

    it('text-align:center centers text in container', () => {
        const buffer = render('.box{width:20cell;text-align:center}', (root) => {
            const box = new TermNode('element', 'div')
            box.attributes.set('class', 'box')
            const text = new TermNode('text', 'Hi')
            box.insertBefore(text, null)
            root.insertBefore(box, null)
        })
        // "Hi" is 2 chars, container is 20 wide → offset = (20-2)/2 = 9
        assert.equal(buffer.getCell(9, 0)?.char, 'H')
        assert.equal(buffer.getCell(10, 0)?.char, 'i')
    })

    it('text-align:right aligns text to right edge', () => {
        const buffer = render('.box{width:20cell;text-align:right}', (root) => {
            const box = new TermNode('element', 'div')
            box.attributes.set('class', 'box')
            const text = new TermNode('text', 'Hi')
            box.insertBefore(text, null)
            root.insertBefore(box, null)
        })
        // "Hi" is 2 chars → starts at 20-2=18
        assert.equal(buffer.getCell(18, 0)?.char, 'H')
        assert.equal(buffer.getCell(19, 0)?.char, 'i')
    })

    it('text-align:left is default (text at start)', () => {
        const buffer = render('.box{width:20cell}', (root) => {
            const box = new TermNode('element', 'div')
            box.attributes.set('class', 'box')
            const text = new TermNode('text', 'Hi')
            box.insertBefore(text, null)
            root.insertBefore(box, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
    })
})

describe('br element', () => {

    it('br causes a line break in inline flow', () => {
        const buffer = render('', (root) => {
            const p = new TermNode('element', 'p')
            const t1 = new TermNode('text', 'Hello')
            p.insertBefore(t1, null)
            const br = new TermNode('element', 'br')
            p.insertBefore(br, null)
            const t2 = new TermNode('text', 'World')
            p.insertBefore(t2, null)
            root.insertBefore(p, null)
        })
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(0, 1)?.char, 'W')
    })
})
