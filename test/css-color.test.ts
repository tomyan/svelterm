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
    })

    describe('hex colors matching ANSI exactly', () => {
        it('resolves #0ff to cyan', () => assert.equal(resolveColor('#0ff'), 'cyan'))
        it('resolves #00ffff to cyan', () => assert.equal(resolveColor('#00ffff'), 'cyan'))
        it('resolves #ff0 to yellow', () => assert.equal(resolveColor('#ff0'), 'yellow'))
        it('resolves #ffff00 to yellow', () => assert.equal(resolveColor('#ffff00'), 'yellow'))
        it('resolves #f00 to red', () => assert.equal(resolveColor('#f00'), 'red'))
        it('resolves #00f to blue', () => assert.equal(resolveColor('#00f'), 'blue'))
        it('resolves #0f0 to green', () => assert.equal(resolveColor('#0f0'), 'green'))
        it('resolves #f0f to magenta', () => assert.equal(resolveColor('#f0f'), 'magenta'))
        it('resolves #fff to white', () => assert.equal(resolveColor('#fff'), 'white'))
        it('resolves #000 to black', () => assert.equal(resolveColor('#000'), 'black'))
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
        it('returns default for unknown named color', () => {
            assert.equal(resolveColor('chartreuse'), 'default')
        })

        it('returns default for empty string', () => {
            assert.equal(resolveColor(''), 'default')
        })

        it('returns default for rgb() notation', () => {
            assert.equal(resolveColor('rgb(255, 0, 0)'), 'default')
        })
    })
})
