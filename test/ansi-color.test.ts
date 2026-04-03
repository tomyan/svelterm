import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { fgColor, bgColor } from '../src/render/ansi.js'

describe('ansi color output', () => {

    it('handles 6-digit hex color', () => {
        const result = fgColor('#ff8800')
        assert.equal(result, '\x1b[38;2;255;136;0m')
    })

    it('handles 3-digit hex color by expanding', () => {
        const result = fgColor('#f80')
        // #f80 → #ff8800 → rgb(255,136,0)
        assert.equal(result, '\x1b[38;2;255;136;0m')
    })

    it('bg handles 3-digit hex color', () => {
        const result = bgColor('#fff')
        assert.equal(result, '\x1b[48;2;255;255;255m')
    })

    it('handles named ANSI colors', () => {
        assert.equal(fgColor('red'), '\x1b[31m')
        assert.equal(bgColor('blue'), '\x1b[44m')
    })

    it('returns empty for unknown color', () => {
        assert.equal(fgColor('nonsense'), '')
    })
})
