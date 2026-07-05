import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { TermNode } from '../src/renderer/node.js'
import { TextBuffer } from '../src/components/text-buffer.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'

const press = (key: string, ctrl = false) => ({ key, ctrl, shift: false, meta: false })

function paintInputRow(input: TermNode, width = 20): string {
    const root = new TermNode('element', 'root')
    root.insertBefore(input, null)
    const styles = resolveStyles(root, parseCSS(DEFAULT_STYLESHEET))
    const layout = computeLayout(root, styles, width, 3)
    const buffer = new CellBuffer(width, 3)
    paint(root, buffer, styles, layout)
    let line = ''
    for (let x = 0; x < width; x++) line += buffer.getCell(x, 0)?.char ?? ' '
    return line.replace(/\s+$/, '')
}

describe('input type=password masks its value', () => {

    it('paints bullets instead of the value characters', () => {
        // Given
        const input = new TermNode('element', 'input')
        input.attributes.set('type', 'password')
        input.attributes.set('value', 'hunter2')

        // When
        const row = paintInputRow(input)

        // Then: same length, no plaintext
        assert.equal(row, '•'.repeat(7))
    })

    it('a text input still paints its value', () => {
        const input = new TermNode('element', 'input')
        input.attributes.set('value', 'visible')
        assert.equal(paintInputRow(input), 'visible')
    })
})

describe('maxlength caps insertion', () => {

    it('typing stops at the limit', () => {
        // Given
        const buf = new TextBuffer('abcd')
        buf.maxLength = 5

        // When
        buf.handleKey(press('e'))
        buf.handleKey(press('f'))

        // Then
        assert.equal(buf.text, 'abcde')
        assert.equal(buf.cursor, 5)
    })

    it('paste truncates to the remaining room', () => {
        // Given
        const buf = new TextBuffer('12345678')
        buf.maxLength = 10

        // When
        buf.insert('abcdef')

        // Then: only 2 chars fit
        assert.equal(buf.text, '12345678ab')
    })

    it('an over-long initial value can still be edited down', () => {
        // Given: value longer than the limit (as browsers allow)
        const buf = new TextBuffer('toolongvalue')
        buf.maxLength = 4

        // When
        buf.handleKey(press('x'))       // blocked — already over
        buf.handleKey(press('Backspace'))

        // Then
        assert.equal(buf.text, 'toolongvalu')
    })
})

describe('readonly blocks edits but not caret movement', () => {

    it('character keys and deletions leave the value unchanged', () => {
        // Given
        const buf = new TextBuffer('locked')
        buf.readOnly = true

        // When
        buf.handleKey(press('x'))
        buf.handleKey(press('Backspace'))
        buf.handleKey(press('Delete'))
        buf.handleKey(press('u', true))   // ctrl+u clear-to-start
        buf.insert('paste')

        // Then
        assert.equal(buf.text, 'locked')
    })

    it('arrow, home, and end keys still move the caret', () => {
        // Given
        const buf = new TextBuffer('locked')
        buf.readOnly = true

        // When / Then
        assert.equal(buf.handleKey(press('ArrowLeft')), true)
        assert.equal(buf.cursor, 5)
        assert.equal(buf.handleKey(press('Home')), true)
        assert.equal(buf.cursor, 0)
        assert.equal(buf.handleKey(press('End')), true)
        assert.equal(buf.cursor, 6)
    })
})
