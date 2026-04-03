import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paintNodes } from '../src/render/incremental-paint.js'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import type { ResolvedStyle } from '../src/css/compute.js'
import type { LayoutBox } from '../src/layout/engine.js'

describe('incremental paint text features', () => {

    it('respects text-align:center from parent', () => {
        const root = new TermNode('element', 'root')
        const parent = new TermNode('element', 'div')
        const text = new TermNode('text', 'Hi')
        parent.insertBefore(text, null)
        root.insertBefore(parent, null)

        const parentStyle: ResolvedStyle = { ...defaultStyle('div'), textAlign: 'center', width: 20 }
        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))
        styles.set(parent.id, parentStyle)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 5 })
        layout.set(parent.id, { x: 0, y: 0, width: 20, height: 1 })
        layout.set(text.id, { x: 0, y: 0, width: 2, height: 1 })

        const buffer = new CellBuffer(20, 5)
        paintNodes(new Set([text]), buffer, styles, layout, root)

        // "Hi" should be centered in 20-wide parent: (20-2)/2 = 9
        assert.equal(buffer.getCell(9, 0)?.char, 'H')
        assert.equal(buffer.getCell(10, 0)?.char, 'i')
    })

    it('respects white-space:nowrap and text-overflow:ellipsis from parent', () => {
        const root = new TermNode('element', 'root')
        const parent = new TermNode('element', 'div')
        const text = new TermNode('text', 'Hello World')
        parent.insertBefore(text, null)
        root.insertBefore(parent, null)

        const parentStyle: ResolvedStyle = {
            ...defaultStyle('div'),
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            width: 8,
        }
        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))
        styles.set(parent.id, parentStyle)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 5 })
        layout.set(parent.id, { x: 0, y: 0, width: 8, height: 1 })
        layout.set(text.id, { x: 0, y: 0, width: 11, height: 1 })

        const buffer = new CellBuffer(20, 5)
        paintNodes(new Set([text]), buffer, styles, layout, root)

        // Should truncate with ellipsis at width 8
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(7, 0)?.char, '…')
    })
})
