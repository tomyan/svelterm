import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { InlineScreen } from '../src/render/inline.js'
import { CellBuffer } from '../src/render/buffer.js'
import { matchCPR, parseCPRRow } from '../src/terminal/capabilities.js'

function frame(rows: string[], width = 20): CellBuffer {
    const buffer = new CellBuffer(width, rows.length)
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) buffer.setCell(x, y, { char: row[x] })
    })
    return buffer
}

describe('CPR parsing', () => {

    it('matches a cursor position report and extracts the row', () => {
        assert.equal(matchCPR('\x1b[12;1R'), '\x1b[12;1R')
        assert.equal(parseCPRRow('\x1b[12;1R'), 12)
        assert.equal(matchCPR('\x1b[A'), null)
    })
})

describe('inline origin tracking', () => {

    it('maps screen rows to zone rows once the origin is known', () => {
        // Given: zone starts at screen row 5 (1-based), two content rows
        const screen = new InlineScreen()
        screen.setOriginRow(5)
        screen.render(frame(['one', 'two']))

        // Then (mouse rows are 0-based): screen row 4 = zone row 0
        assert.equal(screen.screenRowToZone(4, 24), 0)
        assert.equal(screen.screenRowToZone(5, 24), 1)
        assert.equal(screen.screenRowToZone(3, 24), null)
        assert.equal(screen.screenRowToZone(6, 24), null)
    })

    it('returns null before the origin is known', () => {
        const screen = new InlineScreen()
        screen.render(frame(['one']))
        assert.equal(screen.screenRowToZone(0, 24), null)
    })

    it('accounts for the zone scrolling when it grows past the bottom', () => {
        // Given: origin at row 20 of a 24-row screen, zone grows to 10 rows
        const screen = new InlineScreen()
        screen.setOriginRow(20)
        screen.render(frame(Array.from({ length: 10 }, (_, i) => `row ${i}`)))

        // Then: zone bottom pinned to screen bottom → effective origin 15
        assert.equal(screen.screenRowToZone(14, 24), 0)
        assert.equal(screen.screenRowToZone(23, 24), 9)
    })

    it('archiving moves the origin down past the released rows', () => {
        // Given
        const screen = new InlineScreen()
        screen.setOriginRow(5)
        screen.render(frame(['a', 'b', 'c']))

        // When
        screen.releaseTop(2)
        screen.render(frame(['c']))

        // Then: zone row 0 now sits where row 2 was (screen row 6, 0-based)
        assert.equal(screen.screenRowToZone(6, 24), 0)
        assert.equal(screen.screenRowToZone(4, 24), null)
    })
})
