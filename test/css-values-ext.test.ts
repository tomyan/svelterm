import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCellValue } from '../src/css/values.js'
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
    return { buffer, layout, styles }
}

describe('% for padding and margin', () => {

    it.skip('padding in % resolves relative to parent width (TODO: deferred resolution)', () => {
        const { layout } = render(
            '.parent{width:40cell}.child{padding-left:10%}',
            (root) => {
                const parent = new TermNode('element', 'div')
                parent.attributes.set('class', 'parent')
                const child = new TermNode('element', 'div')
                child.attributes.set('class', 'child')
                const text = new TermNode('text', 'Hi')
                child.insertBefore(text, null)
                parent.insertBefore(child, null)
                root.insertBefore(parent, null)
            },
        )
        // 10% of 40 = 4 cells padding
        const textBox = [...layout.values()].find(b => b.width === 2 && b.x >= 4)
        assert.ok(textBox, 'text should be offset by 4 cells (10% of 40)')
    })
})

describe('inherit keyword', () => {

    it('color:inherit uses parent computed color', () => {
        const { buffer } = render(
            '.parent{color:cyan}.child{color:inherit}',
            (root) => {
                const parent = new TermNode('element', 'div')
                parent.attributes.set('class', 'parent')
                const child = new TermNode('element', 'span')
                child.attributes.set('class', 'child')
                const text = new TermNode('text', 'Hi')
                child.insertBefore(text, null)
                parent.insertBefore(child, null)
                root.insertBefore(parent, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
    })
})

describe('currentColor', () => {

    it('border-color:currentColor uses the computed color', () => {
        const { buffer } = render(
            '.box{color:green;border:single;border-color:currentColor;width:10cell;height:3cell}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            },
        )
        // Border should be green (same as color)
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })
})
