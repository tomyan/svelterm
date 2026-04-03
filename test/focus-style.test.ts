import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function renderWithCSS(css: string, buildTree: (root: TermNode) => void, width = 40, height = 10) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe(':focus pseudo-class', () => {

    it('unfocused button has default border color', () => {
        const buffer = renderWithCSS(
            'button{border:single;border-color:white;width:10px;height:3px}button:focus{border-color:cyan}',
            (root) => {
                const btn = new TermNode('element', 'button')
                root.insertBefore(btn, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'white')
    })

    it('focused button gets :focus border color', () => {
        const buffer = renderWithCSS(
            'button{border:single;border-color:white;width:10px;height:3px}button:focus{border-color:cyan}',
            (root) => {
                const btn = new TermNode('element', 'button')
                btn.attributes.set('data-focused', 'true')
                root.insertBefore(btn, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
    })

    it('focused button with class selector', () => {
        const buffer = renderWithCSS(
            '.btn{border:single;border-color:white;width:10px;height:3px}.btn:focus{border-color:green}',
            (root) => {
                const btn = new TermNode('element', 'button')
                btn.attributes.set('class', 'btn')
                btn.attributes.set('data-focused', 'true')
                root.insertBefore(btn, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })
})
