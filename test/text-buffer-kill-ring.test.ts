import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TextBuffer } from '../src/components/text-buffer.js'
import type { KeyEvent } from '../src/input/keyboard.js'

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
    return { key: k, ctrl: false, shift: false, meta: false, ...mods }
}

describe('TextBuffer kill ring', () => {

    it('killToEnd pushes the killed text; yank reinserts it', () => {
        // Given (mirrors sumi TestYank)
        const buf = new TextBuffer('hello world')
        buf.cursor = 5

        // When
        buf.killToEnd() // kills " world"
        buf.home()
        buf.yank()

        // Then
        assert.equal(buf.text, ' worldhello')
        assert.equal(buf.cursor, 6)
    })

    it('killToStart pushes the killed text', () => {
        const buf = new TextBuffer('hello world')
        buf.cursor = 5
        buf.killToStart()
        assert.equal(buf.text, ' world')
        assert.equal(buf.cursor, 0)
        buf.end()
        buf.yank()
        assert.equal(buf.text, ' worldhello')
    })

    it('killWordLeft pushes the killed word', () => {
        const buf = new TextBuffer('hello world')
        buf.killWordLeft() // kills "world"
        buf.home()
        buf.yank()
        assert.equal(buf.text, 'worldhello ')
    })

    it('killWordRight pushes the killed word', () => {
        const buf = new TextBuffer('hello world')
        buf.cursor = 0
        buf.killWordRight() // kills "hello"
        buf.end()
        buf.yank()
        assert.equal(buf.text, ' worldhello')
    })

    it('cutting a selection pushes it onto the ring', () => {
        const buf = new TextBuffer('hello world')
        buf.cursor = 0
        buf.beginExtend()
        buf.cursor = 6
        buf.handleKey(key('w', { ctrl: true })) // cut "hello "
        buf.end()
        buf.yank()
        assert.equal(buf.text, 'worldhello ')
    })

    it('yank with an empty ring does nothing', () => {
        const buf = new TextBuffer('hello')
        buf.yank()
        assert.equal(buf.text, 'hello')
    })

    it('killing nothing pushes nothing', () => {
        const buf = new TextBuffer('hello')
        buf.killToEnd() // cursor at end — kills ""
        buf.yank()
        assert.equal(buf.text, 'hello')
    })

    it('yankPop cycles to the previous kill', () => {
        // Given (mirrors sumi TestYankPop)
        const buf = new TextBuffer('aaa bbb ccc')
        buf.cursor = 3
        buf.killToEnd() // ring: [" bbb ccc"]
        buf.text = 'aaa'
        buf.cursor = 3
        buf.killToStart() // ring: [" bbb ccc", "aaa"]

        // When
        buf.yank()
        assert.equal(buf.text, 'aaa')
        buf.yankPop()

        // Then
        assert.equal(buf.text, ' bbb ccc')
    })

    it('yankPop requires a yank immediately before', () => {
        // Given (mirrors sumi TestYankPopRequiresYankFirst)
        const buf = new TextBuffer('hello world')
        buf.cursor = 5
        buf.killToEnd()
        buf.text = 'hello'
        buf.cursor = 5

        // When — no yank first
        buf.yankPop()

        // Then
        assert.equal(buf.text, 'hello')
    })

    it('movement between yank and yankPop breaks the chain', () => {
        const buf = new TextBuffer('aaa')
        buf.cursor = 0
        buf.killToEnd()
        buf.text = 'bbb'
        buf.cursor = 3
        buf.killToStart() // ring: ["aaa", "bbb"]
        buf.yank() // "bbb"
        buf.handleKey(key('ArrowLeft'))
        buf.yankPop()
        assert.equal(buf.text, 'bbb')
    })

    it('yankPop wraps around the ring', () => {
        const buf = new TextBuffer('')
        for (const word of ['one', 'two']) {
            buf.text = word
            buf.cursor = word.length
            buf.killToStart()
        }
        buf.yank() // "two"
        buf.yankPop() // "one"
        buf.yankPop() // wraps back to "two"
        assert.equal(buf.text, 'two')
    })

    it('maxLength caps yanked text', () => {
        const buf = new TextBuffer('abcdef')
        buf.cursor = 0
        buf.killToEnd()
        buf.maxLength = 3
        buf.yank()
        assert.equal(buf.text, 'abc')
    })

    it('readOnly blocks kills and yank', () => {
        const buf = new TextBuffer('hello')
        buf.cursor = 0
        buf.killToEnd() // ring: ["hello"], text now ""
        buf.text = 'world'
        buf.readOnly = true
        buf.cursor = 0
        buf.killToEnd()
        assert.equal(buf.text, 'world')
        buf.yank()
        assert.equal(buf.text, 'world')
    })
})

describe('TextBuffer transpose', () => {

    it('swaps the characters around the cursor and advances', () => {
        // Given (mirrors sumi TestTransposeChars)
        const buf = new TextBuffer('abcd')
        buf.cursor = 2

        // When
        buf.transposeChars()

        // Then
        assert.equal(buf.text, 'acbd')
        assert.equal(buf.cursor, 3)
    })

    it('at the end transposes the two characters before the cursor', () => {
        // Given (mirrors sumi TestTransposeCharsAtEnd)
        const buf = new TextBuffer('abcd')
        buf.transposeChars()
        assert.equal(buf.text, 'abdc')
        assert.equal(buf.cursor, 4)
    })

    it('does nothing with fewer than two characters', () => {
        const buf = new TextBuffer('a')
        buf.transposeChars()
        assert.equal(buf.text, 'a')
    })

    it('does nothing at the start of the text', () => {
        const buf = new TextBuffer('abcd')
        buf.cursor = 0
        buf.transposeChars()
        assert.equal(buf.text, 'abcd')
    })

    it('is blocked by readOnly', () => {
        const buf = new TextBuffer('abcd')
        buf.readOnly = true
        buf.transposeChars()
        assert.equal(buf.text, 'abcd')
    })
})

describe('readline chord parity (sumi keymap.go)', () => {

    it('Ctrl+B moves left and Ctrl+F moves right', () => {
        const buf = new TextBuffer('abc')
        buf.handleKey(key('b', { ctrl: true }))
        assert.equal(buf.cursor, 2)
        buf.handleKey(key('f', { ctrl: true }))
        assert.equal(buf.cursor, 3)
    })

    it('Ctrl+H backspaces', () => {
        const buf = new TextBuffer('abc')
        buf.handleKey(key('h', { ctrl: true }))
        assert.equal(buf.text, 'ab')
    })

    it('Ctrl+D deletes forward', () => {
        const buf = new TextBuffer('abc')
        buf.cursor = 0
        buf.handleKey(key('d', { ctrl: true }))
        assert.equal(buf.text, 'bc')
    })

    it('Ctrl+T transposes', () => {
        const buf = new TextBuffer('ab')
        buf.handleKey(key('t', { ctrl: true }))
        assert.equal(buf.text, 'ba')
    })

    it('Ctrl+Y yanks and Alt+Y cycles', () => {
        const buf = new TextBuffer('')
        for (const word of ['one', 'two']) {
            buf.text = word
            buf.cursor = word.length
            buf.killToStart()
        }
        buf.handleKey(key('y', { ctrl: true }))
        assert.equal(buf.text, 'two')
        buf.handleKey(key('y', { meta: true }))
        assert.equal(buf.text, 'one')
    })

    it('Ctrl+B/F collapse an active selection', () => {
        const buf = new TextBuffer('hello')
        buf.cursor = 0
        buf.handleKey(key('ArrowRight', { shift: true }))
        buf.handleKey(key('b', { ctrl: true }))
        assert.equal(buf.selectionRange(), null)
    })
})
