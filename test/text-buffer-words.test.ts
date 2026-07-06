import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TextBuffer } from '../src/components/text-buffer.js'

describe('TextBuffer word ops', () => {

    describe('wordLeft', () => {
        it('moves from mid-word to word start', () => {
            // Given (mirrors sumi TestWordLeftRight)
            const buf = new TextBuffer('hello world')
            buf.cursor = 8

            // When
            buf.wordLeft()

            // Then
            assert.equal(buf.cursor, 6)
        })

        it('skips spaces then the word before them', () => {
            const buf = new TextBuffer('a  b')
            buf.cursor = 3
            buf.wordLeft()
            assert.equal(buf.cursor, 0)
        })

        it('does nothing at start of text', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 0
            buf.wordLeft()
            assert.equal(buf.cursor, 0)
        })
    })

    describe('wordRight', () => {
        it('moves to the end of the current word', () => {
            // Given (mirrors sumi TestWordLeftRight)
            const buf = new TextBuffer('hello world')
            buf.cursor = 6

            // When
            buf.wordRight()

            // Then
            assert.equal(buf.cursor, 11)
        })

        it('skips spaces then the next word', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 5
            buf.wordRight()
            assert.equal(buf.cursor, 11)
        })

        it('does nothing at end of text', () => {
            const buf = new TextBuffer('hello')
            buf.wordRight()
            assert.equal(buf.cursor, 5)
        })
    })

    describe('killWordLeft', () => {
        it('deletes the word before the cursor', () => {
            // Given (mirrors sumi TestKillWord)
            const buf = new TextBuffer('hello world')
            buf.cursor = 11

            // When
            buf.killWordLeft()

            // Then
            assert.equal(buf.text, 'hello ')
            assert.equal(buf.cursor, 6)
        })

        it('deletes trailing spaces along with the word', () => {
            const buf = new TextBuffer('hello   ')
            buf.killWordLeft()
            assert.equal(buf.text, '')
            assert.equal(buf.cursor, 0)
        })

        it('does nothing at start of text', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 0
            buf.killWordLeft()
            assert.equal(buf.text, 'hello')
        })

        it('is blocked by readOnly', () => {
            const buf = new TextBuffer('hello world')
            buf.readOnly = true
            buf.killWordLeft()
            assert.equal(buf.text, 'hello world')
        })
    })

    describe('killWordRight', () => {
        it('deletes leading spaces and the word after the cursor', () => {
            // Given (mirrors sumi TestKillWordForward)
            const buf = new TextBuffer('hello world')
            buf.cursor = 0

            // When
            buf.killWordRight()

            // Then
            assert.equal(buf.text, ' world')
            assert.equal(buf.cursor, 0)
        })

        it('deletes the space-separated next word from a word end', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 5
            buf.killWordRight()
            assert.equal(buf.text, 'hello')
            assert.equal(buf.cursor, 5)
        })

        it('does nothing at end of text', () => {
            const buf = new TextBuffer('hello')
            buf.killWordRight()
            assert.equal(buf.text, 'hello')
        })

        it('is blocked by readOnly', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 0
            buf.readOnly = true
            buf.killWordRight()
            assert.equal(buf.text, 'hello world')
        })
    })

    describe('grapheme safety', () => {
        it('treats an emoji run as one word', () => {
            const buf = new TextBuffer('\u{1F44D}\u{1F3FD}\u{1F44D}\u{1F3FD} x')
            buf.wordLeft() // over "x"
            buf.wordLeft() // over the emoji word
            assert.equal(buf.cursor, 0)
        })

        it('deletes a whole emoji word', () => {
            const buf = new TextBuffer('\u{1F44D}\u{1F3FD} x')
            buf.cursor = 4 // after the emoji cluster
            buf.killWordLeft()
            assert.equal(buf.text, ' x')
            assert.equal(buf.cursor, 0)
        })
    })

    describe('handleKey word chords', () => {
        it('Alt+B moves word left', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 8
            assert.equal(buf.handleKey({ key: 'b', ctrl: false, shift: false, meta: true }), true)
            assert.equal(buf.cursor, 6)
        })

        it('Alt+F moves word right', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 6
            assert.equal(buf.handleKey({ key: 'f', ctrl: false, shift: false, meta: true }), true)
            assert.equal(buf.cursor, 11)
        })

        it('Ctrl+ArrowLeft moves word left', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 8
            buf.handleKey({ key: 'ArrowLeft', ctrl: true, shift: false, meta: false })
            assert.equal(buf.cursor, 6)
        })

        it('Ctrl+ArrowRight moves word right', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 6
            buf.handleKey({ key: 'ArrowRight', ctrl: true, shift: false, meta: false })
            assert.equal(buf.cursor, 11)
        })

        it('Alt+ArrowLeft moves word left', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 8
            buf.handleKey({ key: 'ArrowLeft', ctrl: false, shift: false, meta: true })
            assert.equal(buf.cursor, 6)
        })

        it('Alt+ArrowRight moves word right', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 6
            buf.handleKey({ key: 'ArrowRight', ctrl: false, shift: false, meta: true })
            assert.equal(buf.cursor, 11)
        })

        it('Ctrl+W deletes word before cursor', () => {
            const buf = new TextBuffer('hello world')
            buf.handleKey({ key: 'w', ctrl: true, shift: false, meta: false })
            assert.equal(buf.text, 'hello ')
            assert.equal(buf.cursor, 6)
        })

        it('Alt+D deletes word after cursor', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 0
            buf.handleKey({ key: 'd', ctrl: false, shift: false, meta: true })
            assert.equal(buf.text, ' world')
        })

        it('Alt+Backspace deletes word before cursor', () => {
            const buf = new TextBuffer('hello world')
            buf.handleKey({ key: 'Backspace', ctrl: false, shift: false, meta: true })
            assert.equal(buf.text, 'hello ')
        })

        it('unbound Alt chord is not handled and inserts nothing', () => {
            const buf = new TextBuffer('hello')
            assert.equal(buf.handleKey({ key: 'q', ctrl: false, shift: false, meta: true }), false)
            assert.equal(buf.text, 'hello')
        })
    })
})
