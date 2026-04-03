import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 30, height = 10) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout }
}

describe('flex-wrap', () => {

    it('wraps items to next line when they exceed container width', () => {
        const { buffer } = render(
            '.row{display:flex;flex-direction:row;flex-wrap:wrap;width:20cell}.item{width:8cell;height:1cell}',
            (root) => {
                const row = new TermNode('element', 'div')
                row.attributes.set('class', 'row')

                for (const label of ['AAA', 'BBB', 'CCC']) {
                    const item = new TermNode('element', 'div')
                    item.attributes.set('class', 'item')
                    const text = new TermNode('text', label)
                    item.insertBefore(text, null)
                    row.insertBefore(item, null)
                }

                root.insertBefore(row, null)
            },
        )
        // 3 items of 8cell each = 24, container is 20 wide
        // First two fit (16), third wraps to row 1
        assert.equal(buffer.getCell(0, 0)?.char, 'A')
        assert.equal(buffer.getCell(8, 0)?.char, 'B')
        assert.equal(buffer.getCell(0, 1)?.char, 'C')
    })
})

describe('margin: auto centering', () => {

    it('margin-left:auto and margin-right:auto centers element', () => {
        const { layout } = render(
            '.centered{width:10cell;margin-left:auto;margin-right:auto}',
            (root) => {
                const el = new TermNode('element', 'div')
                el.attributes.set('class', 'centered')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        // Container is 30 wide, element is 10 wide
        // Auto margins split remaining 20 evenly: 10 each side
        const elBox = [...layout.values()].find(b => b.width === 10)
        assert.ok(elBox, 'centered element should exist')
        assert.equal(elBox!.x, 10)
    })
})
