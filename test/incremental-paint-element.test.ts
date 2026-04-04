import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paintNodes } from '../src/render/incremental-paint.js'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import type { ResolvedStyle } from '../src/css/compute.js'
import type { LayoutBox } from '../src/layout/engine.js'

describe('incremental paint element nodes', () => {

    it('repaints element border when style changes', () => {
        // Given: a button with a border
        const root = new TermNode('element', 'root')
        const btn = new TermNode('element', 'button')
        const text = new TermNode('text', 'OK')
        btn.insertBefore(text, null)
        root.insertBefore(btn, null)

        const btnStyle: ResolvedStyle = {
            ...defaultStyle('button'),
            borderStyle: 'single',
            borderColor: 'gray',
            width: 8,
            height: 3,
        }
        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))
        styles.set(btn.id, btnStyle)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 5 })
        layout.set(btn.id, { x: 0, y: 0, width: 8, height: 3 })
        layout.set(text.id, { x: 1, y: 1, width: 2, height: 1 })
        btn.cache.layoutBox = { x: 0, y: 0, width: 8, height: 3 }

        const buffer = new CellBuffer(20, 5)

        // When: repaint the element
        paintNodes(new Set([btn]), buffer, styles, layout, root)

        // Then: border characters should be present
        assert.equal(buffer.getCell(0, 0)?.char, '┌')
        assert.equal(buffer.getCell(7, 0)?.char, '┐')
        assert.equal(buffer.getCell(0, 2)?.char, '└')
        assert.equal(buffer.getCell(7, 2)?.char, '┘')
        // Text should also be repainted
        assert.equal(buffer.getCell(1, 1)?.char, 'O')
        assert.equal(buffer.getCell(2, 1)?.char, 'K')
    })

    it('repaints element background', () => {
        // Given: a div with background
        const root = new TermNode('element', 'root')
        const div = new TermNode('element', 'div')
        root.insertBefore(div, null)

        const divStyle: ResolvedStyle = {
            ...defaultStyle('div'),
            bg: 'blue',
            width: 5,
            height: 2,
        }
        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))
        styles.set(div.id, divStyle)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 5 })
        layout.set(div.id, { x: 0, y: 0, width: 5, height: 2 })
        div.cache.layoutBox = { x: 0, y: 0, width: 5, height: 2 }

        const buffer = new CellBuffer(20, 5)

        // When
        paintNodes(new Set([div]), buffer, styles, layout, root)

        // Then: background filled
        assert.equal(buffer.getCell(0, 0)?.bg, 'blue')
        assert.equal(buffer.getCell(4, 1)?.bg, 'blue')
    })
})
