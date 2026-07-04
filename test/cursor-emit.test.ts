import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode, SvtRegionNode } from '../src/renderer/node.js'
import { emitFocusCursor } from '../src/render/cursor-emit.js'
import * as ansi from '../src/render/ansi.js'

describe('emitFocusCursor', () => {

    it('returns hideCursor when nothing focused and no region cursor', () => {
        // Given
        const root = new TermNode('element', 'root')

        // When / Then
        assert.equal(emitFocusCursor(root, null), ansi.hideCursor() + ansi.resetCursorShape())
    })

    it('returns hideCursor when focused has no cursor position and no region cursor', () => {
        // Given — a focused button never publishes a cursor position
        const root = new TermNode('element', 'root')
        const button = new TermNode('element', 'button')
        root.insertBefore(button, null)

        // When / Then
        assert.equal(emitFocusCursor(root, button), ansi.hideCursor() + ansi.resetCursorShape())
    })

    it('positions cursor at focused input pos when inViewport', () => {
        // Given
        const root = new TermNode('element', 'root')
        const input = new TermNode('element', 'input')
        input.cache.cursorScreen = { x: 4, y: 2, inViewport: true }
        root.insertBefore(input, null)

        // When
        const out = emitFocusCursor(root, input)

        // Then — moveTo uses 1-based coords, then showCursor
        assert.equal(out, ansi.moveTo(5, 3) + ansi.setCursorShape('bar') + ansi.showCursor())
    })

    it('hides cursor when focused input position is not inViewport', () => {
        // Given — input is focused but its cursor cell is clipped offscreen
        const root = new TermNode('element', 'root')
        const input = new TermNode('element', 'input')
        input.cache.cursorScreen = { x: 4, y: 2, inViewport: false }
        root.insertBefore(input, null)

        // When / Then — focused input wins; region (if any) stays dormant
        assert.equal(emitFocusCursor(root, input), ansi.hideCursor() + ansi.resetCursorShape())
    })

    it('emits region cursor when nothing is focused', () => {
        // Given
        const root = new TermNode('element', 'root')
        const region = new SvtRegionNode()
        region.lastBoxX = 10
        region.lastBoxY = 5
        region.setCursor({ col: 2, row: 1, visible: true })
        root.insertBefore(region, null)

        // When
        const out = emitFocusCursor(root, null)

        // Then
        assert.equal(out, ansi.resetCursorShape() + ansi.moveTo(13, 7) + ansi.showCursor())
    })

    it('emits region cursor with hide when region cursor is invisible', () => {
        // Given
        const root = new TermNode('element', 'root')
        const region = new SvtRegionNode()
        region.lastBoxX = 0
        region.lastBoxY = 0
        region.setCursor({ col: 3, row: 0, visible: false })
        root.insertBefore(region, null)

        // When
        const out = emitFocusCursor(root, null)

        // Then
        assert.equal(out, ansi.resetCursorShape() + ansi.moveTo(4, 1) + ansi.hideCursor())
    })

    it('focused input wins over a registered region cursor', () => {
        // Given — both an input cursor and a region cursor are present
        const root = new TermNode('element', 'root')
        const input = new TermNode('element', 'input')
        input.cache.cursorScreen = { x: 1, y: 1, inViewport: true }
        const region = new SvtRegionNode()
        region.lastBoxX = 20
        region.lastBoxY = 10
        region.setCursor({ col: 0, row: 0, visible: true })
        root.insertBefore(input, null)
        root.insertBefore(region, null)

        // When
        const out = emitFocusCursor(root, input)

        // Then — input position wins
        assert.equal(out, ansi.moveTo(2, 2) + ansi.setCursorShape('bar') + ansi.showCursor())
    })

    it('falls through to region cursor when focused is not an input', () => {
        // Given — focused is a button (no cursor pos); region has a cursor
        const root = new TermNode('element', 'root')
        const button = new TermNode('element', 'button')
        const region = new SvtRegionNode()
        region.lastBoxX = 5
        region.lastBoxY = 2
        region.setCursor({ col: 1, row: 0, visible: true })
        root.insertBefore(button, null)
        root.insertBefore(region, null)

        // When
        const out = emitFocusCursor(root, button)

        // Then
        assert.equal(out, ansi.resetCursorShape() + ansi.moveTo(7, 3) + ansi.showCursor())
    })

    it('finds a region cursor nested inside the tree', () => {
        // Given — the region is not the immediate child
        const root = new TermNode('element', 'root')
        const wrap = new TermNode('element', 'div')
        const region = new SvtRegionNode()
        region.lastBoxX = 0
        region.lastBoxY = 0
        region.setCursor({ col: 0, row: 0, visible: true })
        wrap.insertBefore(region, null)
        root.insertBefore(wrap, null)

        // When
        const out = emitFocusCursor(root, null)

        // Then
        assert.equal(out, ansi.resetCursorShape() + ansi.moveTo(1, 1) + ansi.showCursor())
    })
})
