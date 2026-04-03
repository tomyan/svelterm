import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCalc } from '../src/css/calc.js'

describe('evaluateCalc', () => {

    describe('calc()', () => {
        it('calc(100% - 4cell) with 40 available = 36', () => {
            assert.equal(evaluateCalc('calc(100% - 4cell)', 40), 36)
        })

        it('calc(50% + 5cell) with 20 available = 15', () => {
            assert.equal(evaluateCalc('calc(50% + 5cell)', 20), 15)
        })

        it('calc(10cell * 2) = 20', () => {
            assert.equal(evaluateCalc('calc(10cell * 2)', 40), 20)
        })

        it('calc(100% / 3) with 30 available = 10', () => {
            assert.equal(evaluateCalc('calc(100% / 3)', 30), 10)
        })

        it('returns null for non-calc values', () => {
            assert.equal(evaluateCalc('20cell', 40), null)
            assert.equal(evaluateCalc('auto', 40), null)
        })
    })

    describe('min()', () => {
        it('min(10cell, 50%) picks smaller', () => {
            assert.equal(evaluateCalc('min(10cell, 50%)', 40), 10) // 10 < 20
        })

        it('min(30cell, 50%) picks smaller', () => {
            assert.equal(evaluateCalc('min(30cell, 50%)', 40), 20) // 20 < 30
        })
    })

    describe('max()', () => {
        it('max(10cell, 50%) picks larger', () => {
            assert.equal(evaluateCalc('max(10cell, 50%)', 40), 20) // 20 > 10
        })
    })

    describe('clamp()', () => {
        it('clamp(5cell, 50%, 30cell) with 40 available = 20 (in range)', () => {
            assert.equal(evaluateCalc('clamp(5cell, 50%, 30cell)', 40), 20)
        })

        it('clamp(5cell, 50%, 15cell) with 40 available = 15 (clamped to max)', () => {
            assert.equal(evaluateCalc('clamp(5cell, 50%, 15cell)', 40), 15)
        })

        it('clamp(25cell, 50%, 30cell) with 40 available = 25 (clamped to min)', () => {
            assert.equal(evaluateCalc('clamp(25cell, 50%, 30cell)', 40), 25)
        })
    })
})
