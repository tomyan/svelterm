import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { lerpColor, lerpNumber } from '../src/css/interpolate.js'

describe('colour interpolation', () => {

    it('returns the exact endpoints at t=0 and t=1', () => {
        assert.equal(lerpColor('red', 'blue', 0), 'red')
        assert.equal(lerpColor('red', 'blue', 1), 'blue')
    })

    it('mixes two hex colours channel-wise', () => {
        assert.equal(lerpColor('#000000', '#ffffff', 0.5), '#808080')
        assert.equal(lerpColor('#ff0000', '#00ff00', 0.25), '#bf4000')
    })

    it('mixes ANSI named colours via their nominal palette values', () => {
        assert.equal(lerpColor('red', 'blue', 0.5), '#670077')
    })

    it('mixes a named colour with a hex colour', () => {
        assert.equal(lerpColor('black', '#ffffff', 0.5), '#808080')
    })

    it('returns null when either endpoint is default (unmixable)', () => {
        assert.equal(lerpColor('default', 'red', 0.5), null)
        assert.equal(lerpColor('red', 'default', 0.5), null)
    })
})

describe('number interpolation', () => {

    it('interpolates linearly and rounds to whole cells', () => {
        assert.equal(lerpNumber(0, 10, 0.5), 5)
        assert.equal(lerpNumber(0, 10, 0.26), 3)
        assert.equal(lerpNumber(10, 0, 1), 0)
    })
})
