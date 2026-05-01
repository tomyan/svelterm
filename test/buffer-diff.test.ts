import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer, cellsEqual } from '../src/render/buffer.js'
import { diffBuffers } from '../src/render/diff.js'
import * as ansi from '../src/render/ansi.js'

describe('CellBuffer', () => {

    describe('construction', () => {
        it('creates buffer with given dimensions', () => {
            const buf = new CellBuffer(10, 5)
            assert.equal(buf.width, 10)
            assert.equal(buf.height, 5)
        })

        it('initialises all cells to space with default style', () => {
            const buf = new CellBuffer(3, 2)
            for (let r = 0; r < 2; r++) {
                for (let c = 0; c < 3; c++) {
                    const cell = buf.getCell(c, r)!
                    assert.equal(cell.char, ' ')
                    assert.equal(cell.fg, 'default')
                    assert.equal(cell.bg, 'default')
                    assert.equal(cell.bold, false)
                }
            }
        })
    })

    describe('getCell', () => {
        it('returns undefined for out of bounds col', () => {
            const buf = new CellBuffer(5, 5)
            assert.equal(buf.getCell(-1, 0), undefined)
            assert.equal(buf.getCell(5, 0), undefined)
        })

        it('returns undefined for out of bounds row', () => {
            const buf = new CellBuffer(5, 5)
            assert.equal(buf.getCell(0, -1), undefined)
            assert.equal(buf.getCell(0, 5), undefined)
        })
    })

    describe('setCell', () => {
        it('sets character at position', () => {
            const buf = new CellBuffer(10, 5)
            buf.setCell(3, 2, { char: 'X' })
            assert.equal(buf.getCell(3, 2)?.char, 'X')
        })

        it('preserves existing properties when partial update', () => {
            const buf = new CellBuffer(10, 5)
            buf.setCell(0, 0, { char: 'A', fg: 'red', bold: true })
            buf.setCell(0, 0, { bg: 'blue' })
            const cell = buf.getCell(0, 0)!
            assert.equal(cell.char, 'A')
            assert.equal(cell.fg, 'red')
            assert.equal(cell.bg, 'blue')
            assert.equal(cell.bold, true)
        })

        it('ignores out of bounds writes', () => {
            const buf = new CellBuffer(5, 5)
            buf.setCell(-1, 0, { char: 'X' })
            buf.setCell(5, 0, { char: 'X' })
            // Should not throw, should not corrupt
            assert.equal(buf.getCell(0, 0)?.char, ' ')
        })
    })

    describe('writeText', () => {
        it('writes a string starting at position', () => {
            const buf = new CellBuffer(20, 1)
            buf.writeText(5, 0, 'Hello')
            assert.equal(buf.getCell(5, 0)?.char, 'H')
            assert.equal(buf.getCell(9, 0)?.char, 'o')
            assert.equal(buf.getCell(4, 0)?.char, ' ')
        })

        it('applies style to all characters', () => {
            const buf = new CellBuffer(20, 1)
            buf.writeText(0, 0, 'Hi', { fg: 'cyan', bold: true })
            assert.equal(buf.getCell(0, 0)?.fg, 'cyan')
            assert.equal(buf.getCell(0, 0)?.bold, true)
            assert.equal(buf.getCell(1, 0)?.fg, 'cyan')
        })

        it('clips at buffer boundary', () => {
            const buf = new CellBuffer(5, 1)
            buf.writeText(3, 0, 'Hello')
            assert.equal(buf.getCell(3, 0)?.char, 'H')
            assert.equal(buf.getCell(4, 0)?.char, 'e')
            // 'llo' should be clipped
        })
    })

    describe('clear', () => {
        it('resets all cells to default', () => {
            const buf = new CellBuffer(5, 3)
            buf.setCell(2, 1, { char: 'X', fg: 'red', bold: true })
            buf.clear()
            const cell = buf.getCell(2, 1)!
            assert.equal(cell.char, ' ')
            assert.equal(cell.fg, 'default')
            assert.equal(cell.bold, false)
        })
    })
})

describe('cellsEqual', () => {
    it('equal cells return true', () => {
        const a = { char: 'X', fg: 'red', bg: 'default', bold: true, italic: false, underline: false, strikethrough: false, dim: false, inverse: false }
        assert.ok(cellsEqual(a, { ...a }))
    })

    it('different char returns false', () => {
        const base = { char: 'A', fg: 'default', bg: 'default', bold: false, italic: false, underline: false, strikethrough: false, dim: false, inverse: false }
        assert.ok(!cellsEqual(base, { ...base, char: 'B' }))
    })

    it('different fg returns false', () => {
        const base = { char: 'A', fg: 'red', bg: 'default', bold: false, italic: false, underline: false, strikethrough: false, dim: false, inverse: false }
        assert.ok(!cellsEqual(base, { ...base, fg: 'blue' }))
    })

    it('different bold returns false', () => {
        const base = { char: 'A', fg: 'default', bg: 'default', bold: false, italic: false, underline: false, strikethrough: false, dim: false, inverse: false }
        assert.ok(!cellsEqual(base, { ...base, bold: true }))
    })
})

describe('diffBuffers', () => {

    it('first render outputs all non-empty cells', () => {
        const buf = new CellBuffer(5, 1)
        buf.writeText(0, 0, 'Hi')
        const output = diffBuffers(null, buf)
        assert.ok(output.includes('H'))
        assert.ok(output.includes('i'))
    })

    it('identical buffers produce empty diff', () => {
        const a = new CellBuffer(5, 1)
        a.writeText(0, 0, 'Same')
        const b = new CellBuffer(5, 1)
        b.writeText(0, 0, 'Same')
        const output = diffBuffers(a, b)
        assert.equal(output, '')
    })

    it('only changed cells appear in diff', () => {
        const a = new CellBuffer(5, 1)
        a.writeText(0, 0, 'Hello')
        const b = new CellBuffer(5, 1)
        b.writeText(0, 0, 'Hallo')
        const output = diffBuffers(a, b)

        // Strip ANSI codes to get just content characters
        const content = output.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '')
        assert.equal(content, 'a')
    })

    it('style-only change produces output', () => {
        const a = new CellBuffer(3, 1)
        a.writeText(0, 0, 'Hi', { fg: 'red' })
        const b = new CellBuffer(3, 1)
        b.writeText(0, 0, 'Hi', { fg: 'blue' })
        const output = diffBuffers(a, b)
        assert.ok(output.length > 0, 'style change should produce diff')
    })
})

describe('ANSI helpers', () => {

    describe('fgColor', () => {
        it('outputs ANSI code for named color', () => {
            assert.equal(ansi.fgColor('red'), '\x1b[31m')
            assert.equal(ansi.fgColor('cyan'), '\x1b[36m')
        })

        it('outputs truecolor code for hex', () => {
            assert.equal(ansi.fgColor('#ff8800'), '\x1b[38;2;255;136;0m')
        })

        it('returns empty for unknown name', () => {
            assert.equal(ansi.fgColor('chartreuse'), '')
        })
    })

    describe('bgColor', () => {
        it('outputs ANSI code for named color', () => {
            assert.equal(ansi.bgColor('blue'), '\x1b[44m')
        })

        it('outputs truecolor code for hex', () => {
            assert.equal(ansi.bgColor('#1a1a2e'), '\x1b[48;2;26;26;46m')
        })
    })

    it('moveTo positions cursor', () => {
        assert.equal(ansi.moveTo(5, 3), '\x1b[3;5H')
    })

    it('bold outputs SGR 1', () => {
        assert.equal(ansi.bold(), '\x1b[1m')
    })

    it('italic outputs SGR 3', () => {
        assert.equal(ansi.italic(), '\x1b[3m')
    })

    it('underline outputs SGR 4', () => {
        assert.equal(ansi.underline(), '\x1b[4m')
    })

    it('dim outputs SGR 2', () => {
        assert.equal(ansi.dim(), '\x1b[2m')
    })

    it('strikethrough outputs SGR 9', () => {
        assert.equal(ansi.strikethrough(), '\x1b[9m')
    })
})
