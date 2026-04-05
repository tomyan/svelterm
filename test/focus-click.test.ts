import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { FocusManager } from '../src/input/focus.js'

describe('FocusManager.focusByNode', () => {

    it('focuses a specific registered node', () => {
        // Given
        const fm = new FocusManager()
        const a = new TermNode('element', 'button')
        const b = new TermNode('element', 'button')
        const c = new TermNode('element', 'button')
        fm.register(a)
        fm.register(b)
        fm.register(c)

        // When
        fm.focusByNode(b)

        // Then
        assert.equal(fm.focused, b)
    })

    it('clears previous focus when focusing a new node', () => {
        // Given
        const fm = new FocusManager()
        const a = new TermNode('element', 'button')
        const b = new TermNode('element', 'button')
        fm.register(a)
        fm.register(b)
        fm.focusNext() // focuses a

        // When
        fm.focusByNode(b)

        // Then
        assert.equal(fm.focused, b)
        assert.equal(a.attributes.has('data-focused'), false)
    })

    it('does nothing for unregistered node', () => {
        // Given
        const fm = new FocusManager()
        const a = new TermNode('element', 'button')
        const unknown = new TermNode('element', 'button')
        fm.register(a)
        fm.focusNext()

        // When
        fm.focusByNode(unknown)

        // Then: focus unchanged
        assert.equal(fm.focused, a)
    })
})
