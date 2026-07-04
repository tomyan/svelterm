import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { InlineScreen } from '../src/render/inline.js'
import { CellBuffer } from '../src/render/buffer.js'

function bufferWith(rows: string[], width = 10): CellBuffer {
    const buffer = new CellBuffer(width, rows.length)
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            buffer.setCell(x, y, { char: row[x] })
        }
    })
    return buffer
}

describe('InlineScreen first render', () => {

    it('creates lines with newlines and writes content', () => {
        // Given
        const screen = new InlineScreen()

        // When
        const out = screen.render(bufferWith(['hi', 'yo']))

        // Then: no absolute positioning anywhere
        assert.ok(!out.includes('\x1b[1;1H'), `absolute move in ${JSON.stringify(out)}`)
        assert.ok(out.includes('hi'))
        assert.ok(out.includes('yo'))
        assert.ok(out.includes('\n'))
    })
})

describe('InlineScreen updates', () => {

    it('rewrites only changed cells using relative movement', () => {
        // Given
        const screen = new InlineScreen()
        screen.render(bufferWith(['count 0']))

        // When
        const out = screen.render(bufferWith(['count 1']))

        // Then: only the changed digit is written
        assert.ok(out.includes('1'))
        assert.ok(!out.includes('count'), `rewrote unchanged text: ${JSON.stringify(out)}`)
        assert.ok(!/\x1b\[\d+;\d+H/.test(out), 'used absolute positioning')
    })

    it('grows by emitting newlines at the bottom', () => {
        // Given
        const screen = new InlineScreen()
        screen.render(bufferWith(['one']))

        // When
        const out = screen.render(bufferWith(['one', 'two']))

        // Then
        assert.ok(out.includes('\n'))
        assert.ok(out.includes('two'))
    })

    it('shrinks by erasing to end of screen', () => {
        // Given
        const screen = new InlineScreen()
        screen.render(bufferWith(['one', 'two', 'three']))

        // When
        const out = screen.render(bufferWith(['one']))

        // Then: ED 0 — erase below
        assert.ok(out.includes('\x1b[0J') || out.includes('\x1b[J'), JSON.stringify(out))
    })
})

describe('InlineScreen archiving', () => {

    it('releaseTop shifts the comparison window without emitting anything', () => {
        // Given
        const screen = new InlineScreen()
        screen.render(bufferWith(['old line', 'live a', 'live b']))

        // When: the top row is archived and the live rows re-render shifted up
        screen.releaseTop(1)
        const out = screen.render(bufferWith(['live a', 'live b']))

        // Then: nothing changed on screen, so nothing is emitted
        assert.equal(out, '')
    })

    it('diffs against the shifted content after release', () => {
        // Given
        const screen = new InlineScreen()
        screen.render(bufferWith(['old line', 'live a']))
        screen.releaseTop(1)

        // When
        const out = screen.render(bufferWith(['live b']))

        // Then: only the changed cell is rewritten
        assert.ok(out.includes('b'))
        assert.ok(!out.includes('live'), JSON.stringify(out))
    })
})

describe('InlineScreen finish', () => {

    it('moves the cursor below the content and shows it', () => {
        // Given
        const screen = new InlineScreen()
        screen.render(bufferWith(['one', 'two']))

        // When
        const out = screen.finish()

        // Then
        assert.ok(out.includes('\x1b[?25h'))
        assert.ok(out.includes('\r\n') || /\x1b\[\d+B/.test(out), JSON.stringify(out))
    })
})

describe('InlineScreen cursor placement', () => {

    it('emits relative movement to place the terminal cursor', () => {
        // Given
        const screen = new InlineScreen()
        screen.render(bufferWith(['name: _']))

        // When
        const out = screen.moveCursorTo(6, 0)

        // Then
        assert.ok(!/\x1b\[\d+;\d+H/.test(out), 'used absolute positioning')
        assert.ok(out.includes('\x1b[7G'), JSON.stringify(out))
    })
})
