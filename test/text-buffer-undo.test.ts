import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TextBuffer } from '../src/components/text-buffer.js'
import type { KeyEvent } from '../src/input/keyboard.js'

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
    return { key: k, ctrl: false, shift: false, meta: false, ...mods }
}

describe('TextBuffer undo/redo', () => {

    it('undo reverts an insert, restoring text and cursor', () => {
        // Given
        const buf = new TextBuffer('hello')
        buf.cursor = 5
        buf.insert(' world')

        // When
        buf.undo()

        // Then
        assert.equal(buf.text, 'hello')
        assert.equal(buf.cursor, 5)
    })

    it('multiple undos step back through history', () => {
        const buf = new TextBuffer('')
        buf.insert('a')
        buf.insert('b')
        buf.insert('c')
        buf.undo()
        assert.equal(buf.text, 'ab')
        buf.undo()
        assert.equal(buf.text, 'a')
        buf.undo()
        assert.equal(buf.text, '')
    })

    it('redo reapplies an undone change', () => {
        const buf = new TextBuffer('')
        buf.insert('hi')
        buf.undo()
        buf.redo()
        assert.equal(buf.text, 'hi')
        assert.equal(buf.cursor, 2)
    })

    it('a new mutation clears the redo stack', () => {
        const buf = new TextBuffer('')
        buf.insert('a')
        buf.undo()
        buf.insert('b')
        buf.redo()
        assert.equal(buf.text, 'b')
    })

    it('undo restores a killed word', () => {
        const buf = new TextBuffer('hello world')
        buf.killWordLeft()
        assert.equal(buf.text, 'hello ')
        buf.undo()
        assert.equal(buf.text, 'hello world')
        assert.equal(buf.cursor, 11)
    })

    it('undo of a selection replacement restores text and cursor', () => {
        const buf = new TextBuffer('hello world')
        buf.cursor = 0
        buf.beginExtend()
        buf.cursor = 5
        buf.insert('X') // replaces "hello"
        assert.equal(buf.text, 'X world')
        buf.undo()
        assert.equal(buf.text, 'hello world')
        assert.equal(buf.cursor, 5)
    })

    it('movement does not create undo entries', () => {
        const buf = new TextBuffer('ab')
        buf.insert('c')
        buf.home()
        buf.wordRight()
        buf.undo()
        assert.equal(buf.text, 'ab')
        buf.undo()
        assert.equal(buf.text, 'ab') // nothing further to undo
    })

    it('an insert stopped by maxLength does not create an undo entry', () => {
        const buf = new TextBuffer('abc')
        buf.maxLength = 3
        buf.insert('d')
        buf.undo()
        assert.equal(buf.text, 'abc') // no phantom entry: text was never mutated
        assert.equal(buf.cursor, 3)
    })

    it('undo reverts a whole yank', () => {
        const buf = new TextBuffer('hello world')
        buf.cursor = 5
        buf.killToEnd()
        buf.yank()
        assert.equal(buf.text, 'hello world')
        buf.undo()
        assert.equal(buf.text, 'hello')
    })

    it('yankPop swaps without adding an undo entry (mirrors sumi)', () => {
        // Given — ring: ["one", "two"]
        const buf = new TextBuffer('')
        for (const word of ['one', 'two']) {
            buf.text = word
            buf.cursor = word.length
            buf.killToStart()
        }
        buf.yank() // "two"
        buf.yankPop() // "one"

        // When — one undo steps over both, back to the pre-yank state
        buf.undo()

        // Then
        assert.equal(buf.text, '')
    })

    it('undo with an empty stack does nothing', () => {
        const buf = new TextBuffer('hello')
        buf.undo()
        assert.equal(buf.text, 'hello')
    })

    it('readOnly blocks undo and redo', () => {
        const buf = new TextBuffer('')
        buf.insert('a')
        buf.readOnly = true
        buf.undo()
        assert.equal(buf.text, 'a')
        buf.readOnly = false
        buf.undo()
        buf.readOnly = true
        buf.redo()
        assert.equal(buf.text, '')
    })

    it('Ctrl+_ triggers undo', () => {
        const buf = new TextBuffer('')
        buf.insert('a')
        buf.handleKey(key('_', { ctrl: true }))
        assert.equal(buf.text, '')
    })
})
