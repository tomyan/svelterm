import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'

describe('TermNode.getCursorScreenPos', () => {

    it('returns null by default', () => {
        // Given
        const node = new TermNode('element', 'div')

        // When / Then
        assert.equal(node.getCursorScreenPos(), null)
    })

    it('returns the cached cursor position when paint has set it', () => {
        // Given
        const node = new TermNode('element', 'input')
        node.cache.cursorScreen = { x: 12, y: 5, inViewport: true }

        // When
        const pos = node.getCursorScreenPos()

        // Then
        assert.deepEqual(pos, { x: 12, y: 5, inViewport: true })
    })

    it('returns null after the cached position is cleared', () => {
        // Given
        const node = new TermNode('element', 'input')
        node.cache.cursorScreen = { x: 4, y: 1, inViewport: true }
        node.cache.cursorScreen = null

        // When / Then
        assert.equal(node.getCursorScreenPos(), null)
    })
})
