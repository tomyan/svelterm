/**
 * CSS Color Level 4 parsing tests.
 * Tests modern syntax, oklch, oklab, hwb, lab, lch, hex alpha, angle units.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveColor } from '../src/css/color.js'

describe('modern rgb() syntax', () => {

    it('space-separated rgb', () => {
        assert.equal(resolveColor('rgb(72 202 228)'), '#48cae4')
    })

    it('space-separated with / alpha', () => {
        // Alpha is ignored for terminal output, but should parse without error
        const result = resolveColor('rgb(72 202 228 / 0.5)')
        assert.equal(result, '#48cae4')
    })

    it('percentage values', () => {
        assert.equal(resolveColor('rgb(100% 0% 0%)'), 'red')
    })

    it('legacy comma syntax still works', () => {
        assert.equal(resolveColor('rgb(72, 202, 228)'), '#48cae4')
    })
})

describe('modern hsl() syntax', () => {

    it('space-separated hsl', () => {
        // hsl(0 100% 50%) = pure red
        assert.equal(resolveColor('hsl(0 100% 50%)'), 'red')
    })

    it('space-separated with / alpha', () => {
        assert.equal(resolveColor('hsl(0 100% 50% / 0.5)'), 'red')
    })

    it('legacy comma syntax still works', () => {
        assert.equal(resolveColor('hsl(0, 100%, 50%)'), 'red')
    })

    it('hue wraps around 360', () => {
        // hsl(360 100% 50%) = same as hsl(0 100% 50%) = red
        assert.equal(resolveColor('hsl(360 100% 50%)'), 'red')
    })
})

describe('hex with alpha', () => {

    it('#rrggbbaa parses correctly', () => {
        assert.equal(resolveColor('#ff000080'), '#ff000080')
    })

    it('#rgba shorthand expands', () => {
        assert.equal(resolveColor('#f008'), '#ff000088')
    })

    it('#rrggbb still works', () => {
        assert.equal(resolveColor('#ff0000'), 'red')
    })

    it('#rgb shorthand still works', () => {
        assert.equal(resolveColor('#f00'), 'red')
    })
})

describe('hwb()', () => {

    it('pure red', () => {
        // hwb(0 0% 0%) = pure hue at 0 degrees = red
        assert.equal(resolveColor('hwb(0 0% 0%)'), 'red')
    })

    it('white', () => {
        // hwb(0 100% 0%) = fully white
        assert.equal(resolveColor('hwb(0 100% 0%)'), 'white')
    })

    it('black', () => {
        // hwb(0 0% 100%) = fully black
        assert.equal(resolveColor('hwb(0 0% 100%)'), 'black')
    })

    it('mid grey when w + b = 100%', () => {
        // hwb(0 50% 50%) = grey
        const result = resolveColor('hwb(0 50% 50%)')
        assert.equal(result, '#808080')
    })
})

describe('oklch()', () => {

    it('black', () => {
        assert.equal(resolveColor('oklch(0 0 0)'), 'black')
    })

    it('white', () => {
        assert.equal(resolveColor('oklch(1 0 0)'), 'white')
    })

    it('percentage lightness', () => {
        assert.equal(resolveColor('oklch(0% 0 0)'), 'black')
    })

    it('produces valid hex for a colour', () => {
        // oklch(0.7 0.15 180) should produce a teal/cyan-ish colour
        const result = resolveColor('oklch(0.7 0.15 180)')
        assert.match(result, /^#[0-9a-f]{6}$/)
    })

    it('mid-range values produce reasonable colours', () => {
        // oklch(0.5 0.1 30) should produce a warm mid-tone
        const result = resolveColor('oklch(0.5 0.1 30)')
        assert.match(result, /^#[0-9a-f]{6}$/)
        // Should not be black or white
        assert.notEqual(result, '#000000')
        assert.notEqual(result, '#ffffff')
    })
})

describe('oklab()', () => {

    it('black', () => {
        assert.equal(resolveColor('oklab(0 0 0)'), 'black')
    })

    it('white', () => {
        assert.equal(resolveColor('oklab(1 0 0)'), 'white')
    })

    it('produces valid hex', () => {
        const result = resolveColor('oklab(0.6 0.1 -0.1)')
        assert.match(result, /^#[0-9a-f]{6}$/)
    })
})

describe('lab()', () => {

    it('black', () => {
        assert.equal(resolveColor('lab(0 0 0)'), 'black')
    })

    it('white', () => {
        const result = resolveColor('lab(100 0 0)')
        // Should be very close to white
        assert.match(result, /^#f[a-f][a-f][a-f][a-f][a-f]$|^white$/)
    })

    it('produces valid hex', () => {
        const result = resolveColor('lab(50 40 -60)')
        assert.match(result, /^#[0-9a-f]{6}$/)
    })
})

describe('lch()', () => {

    it('black', () => {
        assert.equal(resolveColor('lch(0 0 0)'), 'black')
    })

    it('produces valid hex for chromatic colour', () => {
        const result = resolveColor('lch(50 70 30)')
        assert.match(result, /^#[0-9a-f]{6}$/)
    })
})

describe('angle units', () => {

    it('deg suffix', () => {
        assert.equal(resolveColor('hsl(0deg 100% 50%)'), 'red')
    })

    it('turn unit', () => {
        // 0.5turn = 180 degrees = cyan
        assert.equal(resolveColor('hsl(0.5turn 100% 50%)'), 'cyan')
    })

    it('rad unit', () => {
        // pi radians = 180 degrees = cyan
        const result = resolveColor('hsl(3.14159rad 100% 50%)')
        // Should be close to cyan
        assert.match(result, /^#0[0-2]ff[f-][f-]$|^cyan$/)
    })

    it('grad unit', () => {
        // 200grad = 180 degrees = cyan
        assert.equal(resolveColor('hsl(200grad 100% 50%)'), 'cyan')
    })
})

describe('transparent', () => {

    it('resolves to transparent black', () => {
        assert.equal(resolveColor('transparent'), '#00000000')
    })
})

describe('existing functionality preserved', () => {

    it('named colours', () => {
        assert.equal(resolveColor('cornflowerblue'), '#6495ed')
    })

    it('ANSI colours', () => {
        assert.equal(resolveColor('cyan'), 'cyan')
    })

    it('hex passthrough', () => {
        assert.equal(resolveColor('#48cae4'), '#48cae4')
    })

    it('unknown returns default', () => {
        assert.equal(resolveColor('not-a-color'), 'default')
    })
})
