import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TextBuffer } from '../src/components/text-buffer.js'
import type { KeyEvent } from '../src/input/keyboard.js'

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
    return { key: k, ctrl: false, shift: false, meta: false, ...mods }
}

function multilineBuffer(text: string, cursor: number): TextBuffer {
    const buf = new TextBuffer(text)
    buf.multiline = true
    buf.cursor = cursor
    return buf
}

describe('TextBuffer multiline', () => {

    it('lineCol locates the cursor', () => {
        // Given (mirrors sumi TestLineColLocatesCursor)
        const buf = multilineBuffer('ab\ncdef\ng', 5) // after "cd" on line 1

        // Then
        assert.deepEqual(buf.lineCol(), { row: 1, col: 2 })
    })

    it('lineCol at the very start and end', () => {
        assert.deepEqual(multilineBuffer('ab\ncd', 0).lineCol(), { row: 0, col: 0 })
        assert.deepEqual(multilineBuffer('ab\ncd', 5).lineCol(), { row: 1, col: 2 })
    })

    it('cursorUp and cursorDown preserve the column and clamp', () => {
        // Given (mirrors sumi TestCursorUpAndDownPreserveColumnAndClamp)
        const buf = multilineBuffer('ab\ncdef\ng', 6) // after "cde"

        // When — up to a shorter line clamps the column
        buf.cursorUp()
        assert.deepEqual(buf.lineCol(), { row: 0, col: 2 })

        // When — down twice lands on the last short line
        buf.cursorDown()
        buf.cursorDown()
        assert.deepEqual(buf.lineCol(), { row: 2, col: 1 })

        // When — down at the last line stays put
        buf.cursorDown()
        assert.equal(buf.lineCol().row, 2)
    })

    it('cursorUp at the first line stays put', () => {
        const buf = multilineBuffer('ab\ncd', 1)
        buf.cursorUp()
        assert.deepEqual(buf.lineCol(), { row: 0, col: 1 })
    })

    describe('handleKey in multiline mode', () => {

        it('Enter inserts a newline, arrows navigate lines', () => {
            // Given (mirrors sumi TestMultilineConstraintHandlesEnterAndArrows)
            const buf = multilineBuffer('hi', 2)

            // When
            assert.equal(buf.handleKey(key('Enter')), true)
            buf.handleKey(key('x'))

            // Then
            assert.equal(buf.text, 'hi\nx')

            // When — Up moves back to line 0
            assert.equal(buf.handleKey(key('ArrowUp')), true)
            assert.equal(buf.lineCol().row, 0)

            // And — Down returns
            assert.equal(buf.handleKey(key('ArrowDown')), true)
            assert.equal(buf.lineCol().row, 1)
        })

        it('readOnly consumes Enter without inserting', () => {
            // Given (mirrors sumi TestMultilineReadonlyBlocksEnter)
            const buf = multilineBuffer('hi', 2)
            buf.readOnly = true

            // When / Then
            assert.equal(buf.handleKey(key('Enter')), true)
            assert.equal(buf.text, 'hi')
        })

        it('Shift+ArrowDown extends the selection by a line', () => {
            const buf = multilineBuffer('ab\ncd', 0)
            buf.handleKey(key('ArrowDown', { shift: true }))
            assert.equal(buf.selectedText(), 'ab\n')
        })

        it('typing replaces a line-spanning selection', () => {
            const buf = multilineBuffer('ab\ncd', 0)
            buf.handleKey(key('ArrowDown', { shift: true }))
            buf.handleKey(key('X'))
            assert.equal(buf.text, 'Xcd')
        })
    })

    describe('single-line buffers are unchanged', () => {

        it('Enter is not consumed', () => {
            const buf = new TextBuffer('hi')
            assert.equal(buf.handleKey(key('Enter')), false)
            assert.equal(buf.text, 'hi')
        })

        it('ArrowUp/Down are not consumed', () => {
            const buf = new TextBuffer('hi')
            assert.equal(buf.handleKey(key('ArrowUp')), false)
            assert.equal(buf.handleKey(key('ArrowDown')), false)
        })
    })
})
