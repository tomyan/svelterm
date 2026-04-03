import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TextBuffer } from '../src/components/text-buffer.js'

describe('TextBuffer', () => {

    describe('initial state', () => {
        it('starts empty with cursor at 0', () => {
            const buf = new TextBuffer()
            assert.equal(buf.text, '')
            assert.equal(buf.cursor, 0)
        })

        it('can be initialized with text', () => {
            const buf = new TextBuffer('hello')
            assert.equal(buf.text, 'hello')
            assert.equal(buf.cursor, 5)
        })
    })

    describe('insert', () => {
        it('inserts character at cursor', () => {
            const buf = new TextBuffer()
            buf.insert('a')
            assert.equal(buf.text, 'a')
            assert.equal(buf.cursor, 1)
        })

        it('inserts multiple characters sequentially', () => {
            const buf = new TextBuffer()
            buf.insert('h')
            buf.insert('i')
            assert.equal(buf.text, 'hi')
            assert.equal(buf.cursor, 2)
        })

        it('inserts at cursor position (middle of text)', () => {
            const buf = new TextBuffer('ac')
            buf.cursor = 1
            buf.insert('b')
            assert.equal(buf.text, 'abc')
            assert.equal(buf.cursor, 2)
        })

        it('inserts string (paste)', () => {
            const buf = new TextBuffer()
            buf.insert('hello world')
            assert.equal(buf.text, 'hello world')
            assert.equal(buf.cursor, 11)
        })
    })

    describe('delete (forward)', () => {
        it('deletes character at cursor', () => {
            const buf = new TextBuffer('abc')
            buf.cursor = 1
            buf.delete()
            assert.equal(buf.text, 'ac')
            assert.equal(buf.cursor, 1)
        })

        it('does nothing at end of text', () => {
            const buf = new TextBuffer('abc')
            buf.delete()
            assert.equal(buf.text, 'abc')
        })

        it('deletes last character', () => {
            const buf = new TextBuffer('a')
            buf.cursor = 0
            buf.delete()
            assert.equal(buf.text, '')
        })
    })

    describe('backspace', () => {
        it('deletes character before cursor', () => {
            const buf = new TextBuffer('abc')
            buf.backspace()
            assert.equal(buf.text, 'ab')
            assert.equal(buf.cursor, 2)
        })

        it('does nothing at start of text', () => {
            const buf = new TextBuffer('abc')
            buf.cursor = 0
            buf.backspace()
            assert.equal(buf.text, 'abc')
            assert.equal(buf.cursor, 0)
        })

        it('deletes in middle', () => {
            const buf = new TextBuffer('abc')
            buf.cursor = 2
            buf.backspace()
            assert.equal(buf.text, 'ac')
            assert.equal(buf.cursor, 1)
        })
    })

    describe('cursor navigation', () => {
        it('moveLeft decrements cursor', () => {
            const buf = new TextBuffer('abc')
            buf.moveLeft()
            assert.equal(buf.cursor, 2)
        })

        it('moveLeft stops at 0', () => {
            const buf = new TextBuffer('abc')
            buf.cursor = 0
            buf.moveLeft()
            assert.equal(buf.cursor, 0)
        })

        it('moveRight increments cursor', () => {
            const buf = new TextBuffer('abc')
            buf.cursor = 0
            buf.moveRight()
            assert.equal(buf.cursor, 1)
        })

        it('moveRight stops at text length', () => {
            const buf = new TextBuffer('abc')
            buf.moveRight()
            assert.equal(buf.cursor, 3)
        })

        it('home moves to start', () => {
            const buf = new TextBuffer('abc')
            buf.home()
            assert.equal(buf.cursor, 0)
        })

        it('end moves to end', () => {
            const buf = new TextBuffer('abc')
            buf.cursor = 0
            buf.end()
            assert.equal(buf.cursor, 3)
        })
    })

    describe('handleKey', () => {
        it('handles printable character', () => {
            const buf = new TextBuffer()
            buf.handleKey({ key: 'a', ctrl: false, shift: false, meta: false })
            assert.equal(buf.text, 'a')
        })

        it('handles Backspace', () => {
            const buf = new TextBuffer('ab')
            buf.handleKey({ key: 'Backspace', ctrl: false, shift: false, meta: false })
            assert.equal(buf.text, 'a')
        })

        it('handles Delete', () => {
            const buf = new TextBuffer('ab')
            buf.cursor = 0
            buf.handleKey({ key: 'Delete', ctrl: false, shift: false, meta: false })
            assert.equal(buf.text, 'b')
        })

        it('handles ArrowLeft', () => {
            const buf = new TextBuffer('ab')
            buf.handleKey({ key: 'ArrowLeft', ctrl: false, shift: false, meta: false })
            assert.equal(buf.cursor, 1)
        })

        it('handles ArrowRight', () => {
            const buf = new TextBuffer('ab')
            buf.cursor = 0
            buf.handleKey({ key: 'ArrowRight', ctrl: false, shift: false, meta: false })
            assert.equal(buf.cursor, 1)
        })

        it('handles Home', () => {
            const buf = new TextBuffer('ab')
            buf.handleKey({ key: 'Home', ctrl: false, shift: false, meta: false })
            assert.equal(buf.cursor, 0)
        })

        it('handles End', () => {
            const buf = new TextBuffer('ab')
            buf.cursor = 0
            buf.handleKey({ key: 'End', ctrl: false, shift: false, meta: false })
            assert.equal(buf.cursor, 2)
        })

        it('ignores Escape', () => {
            const buf = new TextBuffer('ab')
            buf.handleKey({ key: 'Escape', ctrl: false, shift: false, meta: false })
            assert.equal(buf.text, 'ab')
        })

        it('Ctrl+A moves to start', () => {
            const buf = new TextBuffer('hello')
            buf.handleKey({ key: 'a', ctrl: true, shift: false, meta: false })
            assert.equal(buf.cursor, 0)
        })

        it('Ctrl+E moves to end', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 0
            buf.handleKey({ key: 'e', ctrl: true, shift: false, meta: false })
            assert.equal(buf.cursor, 5)
        })

        it('Ctrl+U clears to start', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 3
            buf.handleKey({ key: 'u', ctrl: true, shift: false, meta: false })
            assert.equal(buf.text, 'lo')
            assert.equal(buf.cursor, 0)
        })

        it('Ctrl+K clears to end', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 2
            buf.handleKey({ key: 'k', ctrl: true, shift: false, meta: false })
            assert.equal(buf.text, 'he')
            assert.equal(buf.cursor, 2)
        })
    })
})
