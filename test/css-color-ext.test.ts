import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveColor } from '../src/css/color.js'

describe('rgb() color function', () => {
    it('resolves rgb(255, 0, 0) to #ff0000', () => {
        assert.equal(resolveColor('rgb(255, 0, 0)'), '#ff0000')
    })

    it('resolves rgb(0, 128, 255) to hex', () => {
        assert.equal(resolveColor('rgb(0, 128, 255)'), '#0080ff')
    })

    it('resolves rgb with no spaces', () => {
        assert.equal(resolveColor('rgb(255,255,0)'), '#ffff00')
    })
})

describe('rgba() color function', () => {
    it('resolves rgba keeping alpha as 8-digit hex', () => {
        assert.equal(resolveColor('rgba(0, 255, 0, 0.5)'), '#00ff0080')
    })
})

describe('hsl() color function', () => {
    it('resolves hsl(0, 100%, 50%) to #ff0000', () => {
        assert.equal(resolveColor('hsl(0, 100%, 50%)'), '#ff0000')
    })

    it('resolves hsl(120, 100%, 50%) to #00ff00', () => {
        assert.equal(resolveColor('hsl(120, 100%, 50%)'), '#00ff00')
    })

    it('resolves hsl(240, 100%, 50%) to #0000ff', () => {
        assert.equal(resolveColor('hsl(240, 100%, 50%)'), '#0000ff')
    })
})

describe('CSS named colors', () => {
    it('resolves coral', () => {
        assert.equal(resolveColor('coral'), '#ff7f50')
    })

    it('resolves steelblue', () => {
        assert.equal(resolveColor('steelblue'), '#4682b4')
    })

    it('resolves tomato', () => {
        assert.equal(resolveColor('tomato'), '#ff6347')
    })

    it('resolves gray', () => {
        assert.equal(resolveColor('gray'), '#808080')
    })

    it('resolves darkgreen', () => {
        assert.equal(resolveColor('darkgreen'), '#006400')
    })

    it('is case-insensitive', () => {
        assert.equal(resolveColor('DarkGreen'), '#006400')
    })
})
