import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveColor } from '../src/css/color.js'

describe('rgb() color function', () => {
    it('resolves rgb(255, 0, 0) to #ff0000', () => {
        assert.equal(resolveColor('rgb(255, 0, 0)'), 'red')
    })

    it('resolves rgb(0, 128, 255) to hex', () => {
        assert.equal(resolveColor('rgb(0, 128, 255)'), '#0080ff')
    })

    it('resolves rgb with no spaces', () => {
        assert.equal(resolveColor('rgb(255,255,0)'), 'yellow')
    })
})

describe('rgba() color function', () => {
    it('resolves rgba ignoring alpha', () => {
        assert.equal(resolveColor('rgba(0, 255, 0, 0.5)'), 'green')
    })
})

describe('hsl() color function', () => {
    it('resolves hsl(0, 100%, 50%) to red', () => {
        assert.equal(resolveColor('hsl(0, 100%, 50%)'), 'red')
    })

    it('resolves hsl(120, 100%, 50%) to green', () => {
        assert.equal(resolveColor('hsl(120, 100%, 50%)'), 'green')
    })

    it('resolves hsl(240, 100%, 50%) to blue', () => {
        assert.equal(resolveColor('hsl(240, 100%, 50%)'), 'blue')
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
