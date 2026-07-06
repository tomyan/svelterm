import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { detectVerticalShift, diffBuffers } from '../src/render/diff.js'
import { AnsiScreen } from './helpers/ansi-screen.js'

function buffer(rows: string[], width = 10): CellBuffer {
    const b = new CellBuffer(width, rows.length)
    rows.forEach((row, y) => {
        for (let x = 0; x < width; x++) b.setCell(x, y, { char: row[x] ?? ' ' })
    })
    return b
}

describe('detectVerticalShift', () => {

    it('spots content scrolled up by one row', () => {
        // Given: rows a,b,c,d → b,c,d,e (scrolled up 1, new row 'e' at bottom)
        const prev = buffer(['aaa', 'bbb', 'ccc', 'ddd'])
        const next = buffer(['bbb', 'ccc', 'ddd', 'eee'])

        // When
        const shift = detectVerticalShift(prev, next)

        // Then
        assert.deepEqual(shift, { delta: 1, enteringRows: [3] })
    })

    it('spots content scrolled down by two rows', () => {
        // Given: e,f,a,b → new,new2,e,f
        const prev = buffer(['eee', 'fff', 'aaa', 'bbb'])
        const next = buffer(['111', '222', 'eee', 'fff'])

        // When
        const shift = detectVerticalShift(prev, next)

        // Then
        assert.deepEqual(shift, { delta: -2, enteringRows: [0, 1] })
    })

    it('returns null when there is no clean translation', () => {
        const prev = buffer(['aaa', 'bbb', 'ccc'])
        const next = buffer(['aaa', 'xxx', 'ccc']) // middle row changed, no shift
        assert.equal(detectVerticalShift(prev, next), null)
    })

    it('returns null for an unchanged buffer', () => {
        const prev = buffer(['aaa', 'bbb'])
        const next = buffer(['aaa', 'bbb'])
        assert.equal(detectVerticalShift(prev, next), null)
    })

    it('returns null when the shift is the whole height (no reuse)', () => {
        const prev = buffer(['aaa', 'bbb'])
        const next = buffer(['ccc', 'ddd'])
        assert.equal(detectVerticalShift(prev, next), null)
    })

    it('requires the retained rows to match exactly', () => {
        // Looks like a scroll-up but a retained row differs → not a shift
        const prev = buffer(['aaa', 'bbb', 'ccc'])
        const next = buffer(['bbb', 'XXX', 'ddd'])
        assert.equal(detectVerticalShift(prev, next), null)
    })
})

describe('diffBuffers with scroll optimisation', () => {

    function screenOf(buf: CellBuffer): AnsiScreen {
        const screen = new AnsiScreen(buf.width, buf.height)
        screen.write('\x1b[1;1H')
        screen.write(diffBuffers(null, buf))
        return screen
    }

    function fullRepaint(buf: CellBuffer): string {
        // diffBuffers against a blank buffer of the same size never
        // triggers the scroll path (no clean translation of blank rows).
        const blank = new CellBuffer(buf.width, buf.height)
        return diffBuffers(blank, buf)
    }

    it('a scroll-up produces the same grid as a full repaint', () => {
        // Given
        const prev = buffer(['aaa', 'bbb', 'ccc', 'ddd'])
        const next = buffer(['bbb', 'ccc', 'ddd', 'eee'])
        const screen = screenOf(prev)

        // When: apply the (possibly scroll-optimised) diff
        screen.write('\x1b[1;1H')
        screen.write(diffBuffers(prev, next))

        // Then
        assert.equal(screen.text(), 'bbb\nccc\nddd\neee')
    })

    it('emits a scroll sequence rather than rewriting every row', () => {
        // Given: a tall buffer scrolled up by one
        const rows = Array.from({ length: 20 }, (_, i) => `r${i}`.padEnd(3))
        const prev = buffer(rows)
        const next = buffer([...rows.slice(1), 'r20'])

        // When
        const scrollOut = diffBuffers(prev, next)
        const fullOut = fullRepaint(next)

        // Then: DECSTBM + index appear, and the output is far smaller than
        // a full repaint (only one row painted, not twenty)
        assert.ok(/\x1b\[\d+;\d+r/.test(scrollOut), `no DECSTBM in ${JSON.stringify(scrollOut)}`)
        assert.ok(scrollOut.includes('\x1bD'), 'no index (ESC D)')
        assert.ok(scrollOut.length < fullOut.length / 3, `not compact: ${scrollOut.length} vs ${fullOut.length}`)

        // And it round-trips to the right grid
        const screen = screenOf(prev)
        screen.write('\x1b[1;1H')
        screen.write(scrollOut)
        assert.equal(screen.rowText(0), 'r1')
        assert.equal(screen.rowText(19), 'r20')
    })
})

describe('detectVerticalShift rejects degenerate translations', () => {

    it('a lone blank-row coincidence at near-full height is not a scroll', () => {
        // Given: an app screen where one row's content changed (an animated
        // bar) and the only "translated" evidence is blank row 0 matching
        // blank row 18 — shifting 18 of 19 rows repaints almost everything
        // and tears the display; a plain cell diff is strictly better.
        const rows = (bar: string) => [
            '', 'HEADER', '', 'status line', '', 'loading', bar,
            '', 'FOOTER', '', '', '', '', '', '', '', '', '', '',
        ]
        const prev = buffer(rows('####      '))
        const next = buffer(rows('#####     '))

        // When / Then
        assert.equal(detectVerticalShift(prev, next), null)
    })

    it('requires the retained rows to be the majority of the screen', () => {
        // Given: only 1 of 4 rows would be reused (delta 3)
        const prev = buffer(['aaa', 'bbb', 'ccc', 'ddd'])
        const next = buffer(['ddd', '111', '222', '333'])

        // When / Then: shifting 3/4 of the screen saves nothing
        assert.equal(detectVerticalShift(prev, next), null)
    })

    it('a translation of only blank rows is not a scroll', () => {
        // Given: content changed in place; the "matching" retained rows
        // are all blank, so they are no evidence of movement
        const prev = buffer(['aaa', '', '', ''])
        const next = buffer(['bbb', '', '', ''])

        // When / Then
        assert.equal(detectVerticalShift(prev, next), null)
    })

    it('still detects a genuine one-row scroll of real content', () => {
        const prev = buffer(['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'])
        const next = buffer(['bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg'])
        assert.deepEqual(detectVerticalShift(prev, next), { delta: 1, enteringRows: [5] })
    })
})
