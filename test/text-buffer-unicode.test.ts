import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TextBuffer } from '../src/components/text-buffer.js'

describe('TextBuffer grapheme editing', () => {

    it('moveLeft steps over a whole emoji', () => {
        // Given
        const buffer = new TextBuffer('a👍')

        // When
        buffer.moveLeft()

        // Then: cursor sits before the emoji, not inside its surrogates
        buffer.insert('X')
        assert.equal(buffer.text, 'aX👍')
    })

    it('backspace deletes a whole emoji', () => {
        // Given
        const buffer = new TextBuffer('a👍')

        // When
        buffer.backspace()

        // Then
        assert.equal(buffer.text, 'a')
    })

    it('deleteForward removes a whole grapheme cluster', () => {
        // Given
        const buffer = new TextBuffer('👩‍👩‍👧x')
        buffer.home()

        // When
        buffer.delete()

        // Then
        assert.equal(buffer.text, 'x')
    })

    it('moveRight from home steps over a combining sequence', () => {
        // Given: e + combining acute
        const buffer = new TextBuffer('éx')
        buffer.home()

        // When
        buffer.moveRight()
        buffer.insert('Y')

        // Then
        assert.equal(buffer.text, 'éYx')
    })
})
