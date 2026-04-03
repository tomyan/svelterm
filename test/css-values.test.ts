import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCellValue, parseSizeValue, parseJustify, parseAlign, parsePadding } from '../src/css/values.js'

describe('parseCellValue', () => {
    it('parses bare number', () => assert.equal(parseCellValue('10'), 10))
    it('strips px suffix', () => assert.equal(parseCellValue('20px'), 20))
    it('rounds to integer', () => assert.equal(parseCellValue('3.7'), 4))
    it('rounds px with decimal', () => assert.equal(parseCellValue('1.5px'), 2))
    it('returns 0 for non-numeric', () => assert.equal(parseCellValue('auto'), 0))
    it('returns 0 for empty string', () => assert.equal(parseCellValue(''), 0))
    it('parses zero', () => assert.equal(parseCellValue('0'), 0))
    it('parses 0px', () => assert.equal(parseCellValue('0px'), 0))
})

describe('parseSizeValue', () => {
    it('returns null for auto', () => assert.equal(parseSizeValue('auto'), null))
    it('returns percentage string as-is', () => assert.equal(parseSizeValue('50%'), '50%'))
    it('returns cell count for bare number', () => assert.equal(parseSizeValue('20'), 20))
    it('strips px and returns cell count', () => assert.equal(parseSizeValue('30px'), 30))
    it('returns percentage with px suffix stripped', () => {
        // 100% should stay as percentage
        assert.equal(parseSizeValue('100%'), '100%')
    })
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
        const p = parsePadding('5')
        assert.deepEqual(p, { top: 5, right: 5, bottom: 5, left: 5 })
    })

    it('two values: vertical horizontal', () => {
        const p = parsePadding('1 2')
        assert.deepEqual(p, { top: 1, right: 2, bottom: 1, left: 2 })
    })

    it('three values: top horizontal bottom', () => {
        const p = parsePadding('1 2 3')
        assert.deepEqual(p, { top: 1, right: 2, bottom: 3, left: 2 })
    })

    it('four values: top right bottom left', () => {
        const p = parsePadding('1 2 3 4')
        assert.deepEqual(p, { top: 1, right: 2, bottom: 3, left: 4 })
    })

    it('strips px from shorthand values', () => {
        const p = parsePadding('1px 2px')
        assert.deepEqual(p, { top: 1, right: 2, bottom: 1, left: 2 })
    })
})
