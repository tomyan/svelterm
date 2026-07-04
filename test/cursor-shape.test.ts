import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { emitFocusCursor } from '../src/render/cursor-emit.js'

describe('cursor shape follows editing focus', () => {

    it('emits a bar cursor when a focused input owns the cursor', () => {
        // Given
        const root = new TermNode('element', 'root')
        const input = new TermNode('element', 'input')
        root.insertBefore(input, null)
        input.cache.cursorScreen = { x: 3, y: 1, inViewport: true }

        // When
        const out = emitFocusCursor(root, input)

        // Then
        assert.ok(out.includes('\x1b[6 q'), `expected bar shape in ${JSON.stringify(out)}`)
    })

    it('restores the default shape when no editable cursor is shown', () => {
        // Given
        const root = new TermNode('element', 'root')

        // When
        const out = emitFocusCursor(root, null)

        // Then
        assert.ok(out.includes('\x1b[0 q'), `expected default shape in ${JSON.stringify(out)}`)
    })
})
