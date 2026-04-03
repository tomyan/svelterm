import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderScrollbar } from '../src/render/scrollbar.js'
import { CellBuffer } from '../src/render/buffer.js'

describe('renderScrollbar', () => {

    it('renders track on the right edge of the box', () => {
        // Given: box at (0,0), 10 wide, 5 tall, content 20 lines, scrollTop 0
        const buffer = new CellBuffer(10, 5)
        renderScrollbar(buffer, { x: 0, y: 0, width: 10, height: 5 }, 20, 0)

        // Then: rightmost column (col 9) has track characters
        for (let row = 0; row < 5; row++) {
            const cell = buffer.getCell(9, row)!
            assert.ok(cell.char === '│' || cell.char === '┃',
                `expected track or thumb at row ${row}, got '${cell.char}'`)
        }
    })

    it('thumb position reflects scroll position at top', () => {
        const buffer = new CellBuffer(10, 10)
        renderScrollbar(buffer, { x: 0, y: 0, width: 10, height: 10 }, 50, 0)

        // Thumb should be at the top
        assert.equal(buffer.getCell(9, 0)?.char, '┃')
    })

    it('thumb moves down as scrollTop increases', () => {
        const buffer = new CellBuffer(10, 10)
        // Scroll to bottom: scrollTop = contentHeight - viewportHeight = 40
        renderScrollbar(buffer, { x: 0, y: 0, width: 10, height: 10 }, 50, 40)

        // Thumb should be at the bottom
        assert.equal(buffer.getCell(9, 9)?.char, '┃')
    })

    it('does not render when content fits in viewport', () => {
        const buffer = new CellBuffer(10, 10)
        renderScrollbar(buffer, { x: 0, y: 0, width: 10, height: 10 }, 5, 0)

        // No scrollbar needed — rightmost column should be space
        assert.equal(buffer.getCell(9, 0)?.char, ' ')
    })
})
