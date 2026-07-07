import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { TextBuffer } from '../src/components/text-buffer.js'
import { RenderContext } from '../src/render/context.js'

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

    it('a programmatic value write resets the editing buffer, caret at end', () => {
        // Given — a focused-and-edited input
        const input = new TermNode('element', 'input')
        input.textBuffer = new TextBuffer('typed text')
        input.textBuffer.cursor = 2
        const ctx = new RenderContext()

        // When — the app assigns a new value (e.g. clearing a filter)
        ctx.onSetAttribute(input, 'value', '')

        // Then
        assert.equal(input.textBuffer.text, '')
        assert.equal(input.textBuffer.cursor, 0)
    })

    it('a textarea value write creates and syncs its display text child', () => {
        // Given — Svelte compiles <textarea>{text}</textarea> to a value write
        const textarea = new TermNode('element', 'textarea')
        const ctx = new RenderContext()
        textarea.ctx = ctx

        // When
        ctx.onSetAttribute(textarea, 'value', 'first\nsecond')

        // Then — the text child carries the value
        assert.equal(textarea.collectText(), 'first\nsecond')

        // And — later writes update it in place
        ctx.onSetAttribute(textarea, 'value', 'changed')
        assert.equal(textarea.collectText(), 'changed')
        assert.equal(textarea.children.filter(c => c.nodeType === 'text').length, 1)
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
