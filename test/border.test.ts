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

        it('renders all four corners', () => {
            const buffer = renderWithCSS('.box{border:single;width:10px;height:5px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            })
            assert.equal(buffer.getCell(0, 0)?.char, '┌')
            assert.equal(buffer.getCell(9, 0)?.char, '┐')
            assert.equal(buffer.getCell(0, 4)?.char, '└')
            assert.equal(buffer.getCell(9, 4)?.char, '┘')
        })

        it('renders horizontal edges', () => {
            const buffer = renderWithCSS('.box{border:single;width:10px;height:5px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            })
            // Top edge
            for (let col = 1; col < 9; col++) {
                assert.equal(buffer.getCell(col, 0)?.char, '─', `top edge at col ${col}`)
            }
            // Bottom edge
            for (let col = 1; col < 9; col++) {
                assert.equal(buffer.getCell(col, 4)?.char, '─', `bottom edge at col ${col}`)
            }
        })

        it('renders vertical edges', () => {
            const buffer = renderWithCSS('.box{border:single;width:10px;height:5px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            })
            for (let row = 1; row < 4; row++) {
                assert.equal(buffer.getCell(0, row)?.char, '│', `left edge at row ${row}`)
                assert.equal(buffer.getCell(9, row)?.char, '│', `right edge at row ${row}`)
            }
        })

        it('interior cells are empty (space)', () => {
            const buffer = renderWithCSS('.box{border:single;width:10px;height:5px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            })
            assert.equal(buffer.getCell(1, 1)?.char, ' ')
            assert.equal(buffer.getCell(5, 2)?.char, ' ')
        })

        it('content starts inside the border', () => {
            const buffer = renderWithCSS('.box{border:single;width:10px;height:5px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const text = new TermNode('text', 'Hi')
                box.insertBefore(text, null)
                root.insertBefore(box, null)
            })
            // Text should be at (1,1) — inside the border, not at (0,0)
            assert.equal(buffer.getCell(1, 1)?.char, 'H')
            assert.equal(buffer.getCell(2, 1)?.char, 'i')
            // Border should still be there
            assert.equal(buffer.getCell(0, 0)?.char, '┌')
        })

        it('content with padding starts inside border + padding', () => {
            const buffer = renderWithCSS('.box{border:single;width:12px;height:5px;padding:1px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const text = new TermNode('text', 'Hi')
                box.insertBefore(text, null)
                root.insertBefore(box, null)
            })
            // Text at (2,2): border(1) + padding(1) on each side
            assert.equal(buffer.getCell(2, 2)?.char, 'H')
            assert.equal(buffer.getCell(3, 2)?.char, 'i')
        })
    })
})
