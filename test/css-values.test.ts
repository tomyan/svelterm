import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCellValue, parseSizeValue, parseJustify, parseAlign, parsePadding } from '../src/css/values.js'

describe('parseCellValue', () => {
    it('parses cell unit', () => assert.equal(parseCellValue('10cell'), 10))
    it('rounds cell value', () => assert.equal(parseCellValue('3.7cell'), 4))
    it('parses zero without unit', () => assert.equal(parseCellValue('0'), 0))
    it('returns 0 for bare number (no unit)', () => assert.equal(parseCellValue('10'), 0))
    it('returns 0 for px (browser unit)', () => assert.equal(parseCellValue('20px'), 0))
    it('returns 0 for em (browser unit)', () => assert.equal(parseCellValue('2em'), 0))
    it('returns 0 for non-numeric', () => assert.equal(parseCellValue('auto'), 0))
    it('returns 0 for empty string', () => assert.equal(parseCellValue(''), 0))
})

describe('parseSizeValue', () => {
    it('returns null for auto', () => assert.equal(parseSizeValue('auto'), null))
    it('returns percentage string as-is', () => assert.equal(parseSizeValue('50%'), '50%'))
    it('returns cell count for cell unit', () => assert.equal(parseSizeValue('20cell'), 20))
    it('returns 0 for px (ignored)', () => assert.equal(parseSizeValue('30px'), 0))
    it('returns percentage for 100%', () => assert.equal(parseSizeValue('100%'), '100%'))
})

describe('parseJustify', () => {
    it('maps flex-start to start', () => assert.equal(parseJustify('flex-start'), 'start'))
    it('maps start to start', () => assert.equal(parseJustify('start'), 'start'))
    it('maps flex-end to end', () => assert.equal(parseJustify('flex-end'), 'end'))
    it('maps center to center', () => assert.equal(parseJustify('center'), 'center'))
    it('maps space-between', () => assert.equal(parseJustify('space-between'), 'space-between'))
    it('maps space-around', () => assert.equal(parseJustify('space-around'), 'space-around'))
    it('maps space-evenly', () => assert.equal(parseJustify('space-evenly'), 'space-evenly'))
    it('defaults to start for unknown', () => assert.equal(parseJustify('banana'), 'start'))
})

describe('parseAlign', () => {
    it('maps flex-start to start', () => assert.equal(parseAlign('flex-start'), 'start'))
    it('maps flex-end to end', () => assert.equal(parseAlign('flex-end'), 'end'))
    it('maps center', () => assert.equal(parseAlign('center'), 'center'))
    it('maps stretch', () => assert.equal(parseAlign('stretch'), 'stretch'))
    it('defaults to start for unknown', () => assert.equal(parseAlign('banana'), 'start'))
})

describe('parsePadding', () => {
    it('single value sets all sides', () => {
        const p = parsePadding('5cell')
        assert.deepEqual(p, { top: 5, right: 5, bottom: 5, left: 5 })
    })

    it('two values: vertical horizontal', () => {
        const p = parsePadding('1cell 2cell')
        assert.deepEqual(p, { top: 1, right: 2, bottom: 1, left: 2 })
    })

    it('three values: top horizontal bottom', () => {
        const p = parsePadding('1cell 2cell 3cell')
        assert.deepEqual(p, { top: 1, right: 2, bottom: 3, left: 2 })
    })

    it('four values: top right bottom left', () => {
        const p = parsePadding('1cell 2cell 3cell 4cell')
        assert.deepEqual(p, { top: 1, right: 2, bottom: 3, left: 4 })
    })

    it('zero without unit works in shorthand', () => {
        const p = parsePadding('0 2cell')
        assert.deepEqual(p, { top: 0, right: 2, bottom: 0, left: 2 })
    })
})
