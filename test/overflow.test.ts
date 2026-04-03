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

describe('overflow: hidden', () => {

    it('text wider than container is clipped horizontally', () => {
        const buffer = renderWithCSS(
            '.box{overflow:hidden;width:5px;height:3px}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const text = new TermNode('text', 'Hello World')
                box.insertBefore(text, null)
                root.insertBefore(box, null)
            },
        )
        // Given: "Hello World" is 11 chars, container is 5 wide
        // Then: only "Hello" should render
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(4, 0)?.char, 'o')
        assert.equal(buffer.getCell(5, 0)?.char, ' ') // clipped
    })

    it('children taller than container are clipped vertically', () => {
        const buffer = renderWithCSS(
            '.box{overflow:hidden;width:10px;height:2px}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                for (let i = 0; i < 5; i++) {
                    const child = new TermNode('element', 'div')
                    const text = new TermNode('text', `Line ${i}`)
                    child.insertBefore(text, null)
                    box.insertBefore(child, null)
                }
                root.insertBefore(box, null)
            },
        )
        // Given: 5 lines, container is 2 tall
        // Then: only lines 0 and 1 visible
        assert.equal(buffer.getCell(0, 0)?.char, 'L') // Line 0
        assert.equal(buffer.getCell(0, 1)?.char, 'L') // Line 1
        assert.equal(buffer.getCell(0, 2)?.char, ' ') // Line 2 clipped
    })

    it('clipping works with border', () => {
        const buffer = renderWithCSS(
            '.box{overflow:hidden;border:single;width:10px;height:4px}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                for (let i = 0; i < 10; i++) {
                    const child = new TermNode('element', 'div')
                    const text = new TermNode('text', `Line ${i}`)
                    child.insertBefore(text, null)
                    box.insertBefore(child, null)
                }
                root.insertBefore(box, null)
            },
        )
        // Border takes 1 cell each side, so inner area is 8x2
        assert.equal(buffer.getCell(0, 0)?.char, '┌') // border
        assert.equal(buffer.getCell(1, 1)?.char, 'L') // Line 0 inside border
        assert.equal(buffer.getCell(1, 2)?.char, 'L') // Line 1 inside border
        assert.equal(buffer.getCell(0, 3)?.char, '└') // bottom border
        // Line 2+ should not appear
    })

    it('without overflow:hidden, content is not clipped', () => {
        const buffer = renderWithCSS(
            '.box{width:5px;height:1px}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const text = new TermNode('text', 'Hello World')
                box.insertBefore(text, null)
                root.insertBefore(box, null)
            },
        )
        // Default overflow is visible — text extends beyond container
        assert.equal(buffer.getCell(5, 0)?.char, ' ') // space char
        assert.equal(buffer.getCell(6, 0)?.char, 'W')
    })
})
