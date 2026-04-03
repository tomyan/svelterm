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

describe('border rendering', () => {

    describe('single border', () => {
        it('renders ┌ at top-left corner', () => {
            const buffer = renderWithCSS('.box{border:single;width:10px;height:5px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            })
            assert.equal(buffer.getCell(0, 0)?.char, '┌')
        })
    })
})
