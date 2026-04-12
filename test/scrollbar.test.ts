import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderScrollbar } from '../src/render/scrollbar.js'
import { CellBuffer } from '../src/render/buffer.js'

describe('renderScrollbar', () => {

    it('renders thumb on the right edge of the viewport', () => {
        // Given: viewport at (0,0), 10 wide, 5 tall, content 20 lines, scrollTop 0
        const buffer = new CellBuffer(10, 5)
        renderScrollbar(buffer, 0, 0, 10, 5, 20, 0, 1)

        // Then: rightmost column (col 9) has thumb characters at top
        const cell = buffer.getCell(9, 0)!
        assert.equal(cell.char, '┃')
    })

    it('thumb position reflects scroll position at top', () => {
        const buffer = new CellBuffer(10, 10)
        renderScrollbar(buffer, 0, 0, 10, 10, 50, 0, 1)

        // Thumb should be at the top
        assert.equal(buffer.getCell(9, 0)?.char, '┃')
    })

    it('thumb moves down as scrollTop increases', () => {
        const buffer = new CellBuffer(10, 10)
        // Scroll to bottom: scrollTop = contentHeight - viewportHeight = 40
        renderScrollbar(buffer, 0, 0, 10, 10, 50, 40, 1)

        // Thumb should be at the bottom
        assert.equal(buffer.getCell(9, 9)?.char, '┃')
    })

    it('does not render when content fits in viewport', () => {
        const buffer = new CellBuffer(10, 10)
        renderScrollbar(buffer, 0, 0, 10, 10, 5, 0, 1)

        // No scrollbar needed — rightmost column should be space
        assert.equal(buffer.getCell(9, 0)?.char, ' ')
    })

    it('renders only thumb, no track', () => {
        // Given: small thumb in a tall viewport
        const buffer = new CellBuffer(10, 10)
        renderScrollbar(buffer, 0, 0, 10, 10, 100, 0, 1)

        // Then: only thumb chars, no track chars in other rows
        const thumbChar = buffer.getCell(9, 0)?.char
        assert.equal(thumbChar, '┃')

        // Non-thumb rows should still be default space
        const nonThumbChar = buffer.getCell(9, 9)?.char
        assert.equal(nonThumbChar, ' ')
    })
})
