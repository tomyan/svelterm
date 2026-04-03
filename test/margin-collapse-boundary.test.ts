import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function findChar(buffer: CellBuffer, char: string, w = 40, h = 20): { col: number; row: number } | null {
    for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('margin collapsing should not occur in flex containers', () => {

    it('margins in flex column do NOT collapse (flex creates BFC)', () => {
        const root = new TermNode('element', 'root')
        const css = '.flex{display:flex;flex-direction:column}.a{margin-bottom:2cell}.b{margin-top:3cell}'
        const sheet = parseCSS(css)
        const flex = new TermNode('element', 'div')
        flex.attributes.set('class', 'flex')
        const a = new TermNode('element', 'div')
        a.attributes.set('class', 'a')
        a.insertBefore(new TermNode('text', 'A'), null)
        flex.insertBefore(a, null)
        const b = new TermNode('element', 'div')
        b.attributes.set('class', 'b')
        b.insertBefore(new TermNode('text', 'B'), null)
        flex.insertBefore(b, null)
        root.insertBefore(flex, null)

        const styles = resolveStyles(root, sheet)
        const layout = computeLayout(root, styles, 40, 20)
        const buffer = new CellBuffer(40, 20)
        paint(root, buffer, styles, layout)

        const posA = findChar(buffer, 'A')!
        const posB = findChar(buffer, 'B')!
        // In flex, margins don't collapse — gap should be 2+3=5
        const gap = posB.row - posA.row - 1
        assert.equal(gap, 5, `flex margins should NOT collapse: got gap ${gap}`)
    })
})
