import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paintNodes } from '../src/render/incremental-paint.js'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import type { ResolvedStyle } from '../src/css/compute.js'
import type { LayoutBox } from '../src/layout/engine.js'

describe('incremental paint background inheritance', () => {

    it('inherits background color from parent', () => {
        // Given: parent has bg:red, child is text
        const root = new TermNode('element', 'root')
        const parent = new TermNode('element', 'div')
        const text = new TermNode('text', 'Hi')
        parent.insertBefore(text, null)
        root.insertBefore(parent, null)

        const parentStyle: ResolvedStyle = { ...defaultStyle('div'), bg: '#ff0000' }
        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))
        styles.set(parent.id, parentStyle)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 5 })
        layout.set(parent.id, { x: 0, y: 0, width: 20, height: 1 })
        layout.set(text.id, { x: 0, y: 0, width: 2, height: 1 })

        // When: incremental paint
        const buffer = new CellBuffer(20, 5)
        paintNodes(new Set([text]), buffer, styles, layout, root)

        // Then: text cells should have parent's bg
        assert.equal(buffer.getCell(0, 0)?.bg, '#ff0000')
        assert.equal(buffer.getCell(1, 0)?.bg, '#ff0000')
    })

    it('inherits hyperlink from anchor parent', () => {
        // Given: parent is <a href="...">
        const root = new TermNode('element', 'root')
        const link = new TermNode('element', 'a')
        link.attributes.set('href', 'https://example.com')
        const text = new TermNode('text', 'click')
        link.insertBefore(text, null)
        root.insertBefore(link, null)

        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))
        styles.set(link.id, defaultStyle('a'))

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 5 })
        layout.set(link.id, { x: 0, y: 0, width: 5, height: 1 })
        layout.set(text.id, { x: 0, y: 0, width: 5, height: 1 })

        // When
        const buffer = new CellBuffer(20, 5)
        paintNodes(new Set([text]), buffer, styles, layout, root)

        // Then: cells should have hyperlink
        assert.equal(buffer.getCell(0, 0)?.hyperlink, 'https://example.com')
    })
})
