import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { CellBuffer } from '../src/render/buffer.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 20) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { layout, buffer }
}

describe('position: absolute', () => {

    it('positions element at top/left offsets', () => {
        const { layout } = render(
            '.overlay{position:absolute;top:5cell;left:10cell;width:15cell;height:5cell}',
            (root) => {
                const overlay = new TermNode('element', 'div')
                overlay.attributes.set('class', 'overlay')
                const text = new TermNode('text', 'Dialog')
                overlay.insertBefore(text, null)
                root.insertBefore(overlay, null)
            },
        )
        const overlay = [...layout.entries()].find(([_, b]) => b.x === 10 && b.y === 5)
        assert.ok(overlay, 'overlay should be at x=10, y=5')
    })

    it('does not affect sibling layout', () => {
        const { buffer } = render(
            '.abs{position:absolute;top:5cell;left:0;width:10cell;height:1cell}',
            (root) => {
                const normal = new TermNode('element', 'div')
                const t1 = new TermNode('text', 'Normal')
                normal.insertBefore(t1, null)
                root.insertBefore(normal, null)

                const abs = new TermNode('element', 'div')
                abs.attributes.set('class', 'abs')
                const t2 = new TermNode('text', 'Absolute')
                abs.insertBefore(t2, null)
                root.insertBefore(abs, null)

                const after = new TermNode('element', 'div')
                const t3 = new TermNode('text', 'After')
                after.insertBefore(t3, null)
                root.insertBefore(after, null)
            },
        )
        // "Normal" at row 0, "After" at row 1 (not row 2 — abs doesn't take space)
        assert.equal(buffer.getCell(0, 0)?.char, 'N')
        assert.equal(buffer.getCell(0, 1)?.char, 'A') // "After", not pushed down
        // "Absolute" at row 5 (absolute positioning)
        assert.equal(buffer.getCell(0, 5)?.char, 'A')
    })

    it('renders on top of other content (z-order)', () => {
        const { buffer } = render(
            '.bg{width:20cell;height:5cell;background-color:blue}.overlay{position:absolute;top:1cell;left:1cell;width:10cell;height:3cell;background-color:red}',
            (root) => {
                const bg = new TermNode('element', 'div')
                bg.attributes.set('class', 'bg')
                root.insertBefore(bg, null)

                const overlay = new TermNode('element', 'div')
                overlay.attributes.set('class', 'overlay')
                const text = new TermNode('text', 'Over')
                overlay.insertBefore(text, null)
                root.insertBefore(overlay, null)
            },
        )
        // Background should be blue
        assert.equal(buffer.getCell(0, 0)?.bg, 'blue')
        // Overlay area should be red (painted on top)
        assert.equal(buffer.getCell(1, 1)?.bg, 'red')
        assert.equal(buffer.getCell(1, 1)?.char, 'O')
    })
})
