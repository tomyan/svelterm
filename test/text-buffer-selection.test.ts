import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TextBuffer } from '../src/components/text-buffer.js'
import type { KeyEvent } from '../src/input/keyboard.js'

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
    return { key: k, ctrl: false, shift: false, meta: false, ...mods }
}

describe('TextBuffer selection', () => {

    describe('shift+movement extends', () => {
        it('Shift+ArrowRight selects the next character', () => {
            // Given
            const buf = new TextBuffer('hello')
            buf.cursor = 0

            // When
            buf.handleKey(key('ArrowRight', { shift: true }))

            // Then
            assert.deepEqual(buf.selectionRange(), { start: 0, end: 1 })
            assert.equal(buf.selectedText(), 'h')
        })

        it('Shift+ArrowLeft selects backwards from the cursor', () => {
            const buf = new TextBuffer('hello')
            buf.handleKey(key('ArrowLeft', { shift: true }))
            buf.handleKey(key('ArrowLeft', { shift: true }))
            assert.deepEqual(buf.selectionRange(), { start: 3, end: 5 })
            assert.equal(buf.selectedText(), 'lo')
        })

        it('Shift+End selects to the end', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 5
            buf.handleKey(key('End', { shift: true }))
            assert.equal(buf.selectedText(), ' world')
        })

        it('Shift+Home selects to the start', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 3
            buf.handleKey(key('Home', { shift: true }))
            assert.equal(buf.selectedText(), 'hel')
        })

        it('Shift+Ctrl+ArrowLeft extends by word', () => {
            const buf = new TextBuffer('hello world')
            buf.handleKey(key('ArrowLeft', { shift: true, ctrl: true }))
            assert.equal(buf.selectedText(), 'world')
        })

        it('Shift+Alt+ArrowRight extends by word', () => {
            const buf = new TextBuffer('hello world')
            buf.cursor = 5
            buf.handleKey(key('ArrowRight', { shift: true, meta: true }))
            assert.equal(buf.selectedText(), ' world')
        })

        it('shrinks when movement reverses over the anchor side', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 0
            buf.handleKey(key('ArrowRight', { shift: true }))
            buf.handleKey(key('ArrowRight', { shift: true }))
            buf.handleKey(key('ArrowLeft', { shift: true }))
            assert.deepEqual(buf.selectionRange(), { start: 0, end: 1 })
        })
    })

    describe('collapse', () => {
        it('unshifted movement collapses the selection', () => {
            const buf = new TextBuffer('hello')
            buf.cursor = 0
            buf.handleKey(key('ArrowRight', { shift: true }))
            buf.handleKey(key('ArrowRight'))
            assert.equal(buf.selectionRange(), null)
        })

        it('an empty extension is no selection', () => {
            const buf = new TextBuffer('hello')
            buf.handleKey(key('ArrowRight', { shift: true })) // at end; cursor cannot move
            assert.equal(buf.selectionRange(), null)
        })
    })

    describe('mutations with an active selection', () => {
        function select(buf: TextBuffer, start: number, end: number): void {
            buf.cursor = start
            for (let i = start; i < end; i++) buf.handleKey(key('ArrowRight', { shift: true }))
        }

        it('typing replaces the selection', () => {
            const buf = new TextBuffer('hello world')
            select(buf, 0, 5)
            buf.handleKey(key('X'))
            assert.equal(buf.text, 'X world')
            assert.equal(buf.cursor, 1)
            assert.equal(buf.selectionRange(), null)
        })

        it('paste replaces the selection', () => {
            const buf = new TextBuffer('hello world')
            select(buf, 6, 11)
            buf.insert('there')
            assert.equal(buf.text, 'hello there')
        })

        it('Backspace deletes only the selection', () => {
            const buf = new TextBuffer('hello world')
            select(buf, 5, 11)
            buf.handleKey(key('Backspace'))
            assert.equal(buf.text, 'hello')
            assert.equal(buf.cursor, 5)
        })

        it('Delete deletes only the selection', () => {
            const buf = new TextBuffer('hello world')
            select(buf, 0, 6)
            buf.handleKey(key('Delete'))
            assert.equal(buf.text, 'world')
            assert.equal(buf.cursor, 0)
        })

        it('word delete removes only the selection', () => {
            const buf = new TextBuffer('hello world')
            select(buf, 0, 5)
            buf.handleKey(key('Backspace', { meta: true }))
            assert.equal(buf.text, ' world')
        })

        it('maxLength applies to the text after replacement', () => {
            const buf = new TextBuffer('hello')
            buf.maxLength = 5
            select(buf, 0, 5)
            buf.insert('goodbye')
            assert.equal(buf.text, 'goodb')
        })
    })

    describe('cut and copy', () => {
        function select(buf: TextBuffer, start: number, end: number): void {
            buf.cursor = start
            for (let i = start; i < end; i++) buf.handleKey(key('ArrowRight', { shift: true }))
        }

        it('Ctrl+W cuts the selection to the clipboard', () => {
            const buf = new TextBuffer('hello world')
            select(buf, 0, 6)
            buf.handleKey(key('w', { ctrl: true }))
            assert.equal(buf.text, 'world')
            assert.equal(buf.drainClipboardText(), 'hello ')
        })

        it('Ctrl+W without a selection deletes the word before the cursor', () => {
            const buf = new TextBuffer('hello world')
            buf.handleKey(key('w', { ctrl: true }))
            assert.equal(buf.text, 'hello ')
            assert.equal(buf.drainClipboardText(), null)
        })

        it('Alt+W copies and keeps the selection', () => {
            const buf = new TextBuffer('hello world')
            select(buf, 6, 11)
            buf.handleKey(key('w', { meta: true }))
            assert.equal(buf.text, 'hello world')
            assert.equal(buf.drainClipboardText(), 'world')
            assert.deepEqual(buf.selectionRange(), { start: 6, end: 11 })
        })

        it('drainClipboardText returns the text once', () => {
            const buf = new TextBuffer('hello')
            select(buf, 0, 5)
            buf.handleKey(key('w', { meta: true }))
            buf.drainClipboardText()
            assert.equal(buf.drainClipboardText(), null)
        })

        it('readOnly blocks cut but not copy', () => {
            const buf = new TextBuffer('hello')
            select(buf, 0, 5)
            buf.readOnly = true
            buf.handleKey(key('w', { ctrl: true }))
            assert.equal(buf.text, 'hello')
            buf.handleKey(key('w', { meta: true }))
            assert.equal(buf.drainClipboardText(), 'hello')
        })
    })

    describe('selectWordAt', () => {
        it('selects the word around the offset', () => {
            const buf = new TextBuffer('hello world')
            buf.selectWordAt(8)
            assert.deepEqual(buf.selectionRange(), { start: 6, end: 11 })
            assert.equal(buf.cursor, 11)
        })

        it('does nothing on whitespace', () => {
            const buf = new TextBuffer('hello world')
            buf.selectWordAt(5)
            assert.equal(buf.selectionRange(), null)
        })

        it('clamps an offset past the end onto the last word', () => {
            const buf = new TextBuffer('hi')
            buf.selectWordAt(2)
            assert.deepEqual(buf.selectionRange(), { start: 0, end: 2 })
        })
    })
})
