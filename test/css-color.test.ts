import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveColor } from '../src/css/color.js'

describe('resolveColor', () => {
    describe('named ANSI colors', () => {
        it('resolves "red" to "red"', () => assert.equal(resolveColor('red'), 'red'))
        it('resolves "cyan" to "cyan"', () => assert.equal(resolveColor('cyan'), 'cyan'))
        it('resolves "black" to "black"', () => assert.equal(resolveColor('black'), 'black'))
        it('is case-insensitive', () => assert.equal(resolveColor('RED'), 'red'))
        it('is case-insensitive for mixed case', () => assert.equal(resolveColor('Cyan'), 'cyan'))
        it('resolves bright variants to themselves', () => {
            assert.equal(resolveColor('brightred'), 'brightred')
            assert.equal(resolveColor('brightBlack'), 'brightblack')
            assert.equal(resolveColor('BRIGHTWHITE'), 'brightwhite')
        })
    })

    describe('exact-primary hexes stay truecolor (keywords are themeable, hex is exact)', () => {
        it('keeps #00ffff as truecolor, not cyan', () => assert.equal(resolveColor('#00ffff'), '#00ffff'))
        it('expands #0ff to #00ffff, not cyan', () => assert.equal(resolveColor('#0ff'), '#00ffff'))
        it('keeps #ffff00 as truecolor, not ANSI yellow', () => assert.equal(resolveColor('#ffff00'), '#ffff00'))
        it('keeps #ff0000 as truecolor, not ANSI red', () => assert.equal(resolveColor('#ff0000'), '#ff0000'))
        it('expands #f00 to #ff0000, not red', () => assert.equal(resolveColor('#f00'), '#ff0000'))
        it('keeps #0000ff as truecolor', () => assert.equal(resolveColor('#00f'), '#0000ff'))
        it('keeps #00ff00 as truecolor', () => assert.equal(resolveColor('#0f0'), '#00ff00'))
        it('keeps #ff00ff as truecolor', () => assert.equal(resolveColor('#f0f'), '#ff00ff'))
        it('keeps #ffffff as truecolor', () => assert.equal(resolveColor('#fff'), '#ffffff'))
        it('keeps #000000 as truecolor', () => assert.equal(resolveColor('#000'), '#000000'))
    })

    describe('hex colors not matching ANSI (truecolor passthrough)', () => {
        it('passes through #ff8800 as expanded hex', () => {
            assert.equal(resolveColor('#ff8800'), '#ff8800')
        })

        it('expands and passes through #f80', () => {
            assert.equal(resolveColor('#f80'), '#ff8800')
        })

        it('passes through #1a1a2e as-is', () => {
            assert.equal(resolveColor('#1a1a2e'), '#1a1a2e')
        })

        it('passes through #333 expanded', () => {
            assert.equal(resolveColor('#333'), '#333333')
        })
    })

    describe('unknown values', () => {
        it('returns default for truly unknown value', () => {
            assert.equal(resolveColor('notacolor'), 'default')
        })

        it('returns default for empty string', () => {
            assert.equal(resolveColor(''), 'default')
        })

        it('CSS named color chartreuse resolves to hex', () => {
            assert.equal(resolveColor('chartreuse'), '#7fff00')
        })

        it('rgb() resolves to exact truecolor', () => {
            assert.equal(resolveColor('rgb(255, 0, 0)'), '#ff0000')
        })
    })
})
