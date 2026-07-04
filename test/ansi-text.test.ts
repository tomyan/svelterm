import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseAnsiText } from '../src/render/ansi-text.js'

describe('parseAnsiText', () => {

    it('splits plain text into lines of default-styled cells', () => {
        // When
        const lines = parseAnsiText('ab\ncd')

        // Then
        assert.equal(lines.length, 2)
        assert.equal(lines[0][0].char, 'a')
        assert.equal(lines[0][0].fg, 'default')
        assert.equal(lines[1][1].char, 'd')
    })

    it('applies 16-colour SGR codes', () => {
        const lines = parseAnsiText('\x1b[31mr\x1b[42mg\x1b[0mp')
        assert.equal(lines[0][0].fg, 'red')
        assert.equal(lines[0][1].bg, 'green')
        assert.equal(lines[0][2].fg, 'default')
        assert.equal(lines[0][2].bg, 'default')
    })

    it('applies bold, dim, italic, underline, inverse and their resets', () => {
        const lines = parseAnsiText('\x1b[1;4mx\x1b[22;24my')
        assert.equal(lines[0][0].bold, true)
        assert.equal(lines[0][0].underline, true)
        assert.equal(lines[0][1].bold, false)
        assert.equal(lines[0][1].underline, false)
    })

    it('applies 256-colour and truecolor foregrounds', () => {
        const lines = parseAnsiText('\x1b[38;5;196ma\x1b[38;2;18;52;86mb')
        assert.equal(lines[0][0].fg, '#ff0000')
        assert.equal(lines[0][1].fg, '#123456')
    })

    it('maps bright colours to their xterm palette values', () => {
        const lines = parseAnsiText('\x1b[91mx')
        assert.equal(lines[0][0].fg, '#ff0000')
    })

    it('drops non-SGR escape sequences', () => {
        const lines = parseAnsiText('\x1b[2Ja\x1b]0;title\x07b')
        assert.equal(lines[0].map(c => c.char).join(''), 'ab')
    })

    it('expands tabs to the next 8-column stop', () => {
        const lines = parseAnsiText('a\tb')
        assert.equal(lines[0].length, 9)
        assert.equal(lines[0][8].char, 'b')
    })
})
