import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'

function scrolledList(scrollTop: number): CellBuffer {
    const root = new TermNode('element', 'root')
    const list = new TermNode('element', 'div')
    list.attributes.set('class', 'list')
    list.scrollTop = scrollTop
    for (let i = 0; i < 30; i++) {
        const row = new TermNode('element', 'div')
        row.insertBefore(new TermNode('text', `row ${i}`), null)
        list.insertBefore(row, null)
    }
    root.insertBefore(list, null)
    const styles = resolveStyles(root, parseCSS(DEFAULT_STYLESHEET + '.list { height: 5cell; overflow: auto; border: single; }'))
    const layout = computeLayout(root, styles, 12, 8)
    const buffer = new CellBuffer(12, 8)
    paint(root, buffer, styles, layout)
    return buffer
}

function rowText(buffer: CellBuffer, row: number): string {
    let out = ''
    for (let col = 0; col < buffer.width; col++) out += buffer.getCell(col, row)?.char ?? ' '
    return out
}

describe('scrolled content clips inside the border', () => {

    it('keeps the top border intact when scrolled', () => {
        // When
        const buffer = scrolledList(3)

        // Then: the border row is all box-drawing, no text bled onto it
        const top = rowText(buffer, 0)
        assert.ok(/^┌─+┐/.test(top), `border corrupted: ${JSON.stringify(top)}`)
        assert.ok(!top.includes('row'), 'content painted on the top border')
    })

    it('keeps the bottom border intact when scrolled', () => {
        const buffer = scrolledList(3)
        const bottom = rowText(buffer, 4)
        assert.ok(/^└─+┘/.test(bottom), `bottom border corrupted: ${JSON.stringify(bottom)}`)
    })

    it('shows the scrolled content inside the border', () => {
        const buffer = scrolledList(3)
        assert.ok(rowText(buffer, 1).includes('row 3'), 'expected row 3 at the top of the interior')
    })
})
