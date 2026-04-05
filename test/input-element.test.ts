import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { TextBuffer } from '../src/components/text-buffer.js'

describe('input element text handling', () => {

    it('TextBuffer on input node handles character insertion', () => {
        // Given
        const input = new TermNode('element', 'input')
        input.textBuffer = new TextBuffer('')

        // When
        input.textBuffer.handleKey({ key: 'h', ctrl: false, shift: false, meta: false })
        input.textBuffer.handleKey({ key: 'i', ctrl: false, shift: false, meta: false })

        // Then
        assert.equal(input.textBuffer.text, 'hi')
        assert.equal(input.textBuffer.cursor, 2)
    })

    it('TextBuffer handles backspace', () => {
        // Given
        const input = new TermNode('element', 'input')
        input.textBuffer = new TextBuffer('hello')

        // When
        input.textBuffer.handleKey({ key: 'Backspace', ctrl: false, shift: false, meta: false })

        // Then
        assert.equal(input.textBuffer.text, 'hell')
    })

    it('TextBuffer handles Ctrl+A (home) and Ctrl+E (end)', () => {
        // Given
        const input = new TermNode('element', 'input')
        input.textBuffer = new TextBuffer('hello')

        // When
        input.textBuffer.handleKey({ key: 'a', ctrl: true, shift: false, meta: false })
        assert.equal(input.textBuffer.cursor, 0)

        input.textBuffer.handleKey({ key: 'e', ctrl: true, shift: false, meta: false })
        assert.equal(input.textBuffer.cursor, 5)
    })

    it('TextBuffer handles arrow keys', () => {
        // Given
        const input = new TermNode('element', 'input')
        input.textBuffer = new TextBuffer('abc')

        // When: cursor at end (3), move left twice
        input.textBuffer.handleKey({ key: 'ArrowLeft', ctrl: false, shift: false, meta: false })
        input.textBuffer.handleKey({ key: 'ArrowLeft', ctrl: false, shift: false, meta: false })

        // Then: cursor at 1
        assert.equal(input.textBuffer.cursor, 1)
    })
})
