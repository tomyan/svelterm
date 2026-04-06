import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { truncateMiddle } from '../src/layout/text.js'

describe('truncateMiddle', () => {

    it('returns text unchanged if it fits', () => {
        assert.equal(truncateMiddle('hello', 10), 'hello')
    })

    it('truncates in the middle with ellipsis', () => {
        const result = truncateMiddle('/Users/tom/projects/svelterm/src/index.ts', 20)
        assert.equal(result.length, 20)
        assert.ok(result.startsWith('/Users/'))
        assert.ok(result.endsWith('index.ts'))
        assert.ok(result.includes('…'))
    })

    it('handles very short width', () => {
        assert.equal(truncateMiddle('hello world', 3), 'he…')
    })

    it('handles width of 1', () => {
        assert.equal(truncateMiddle('hello', 1), '…')
    })

    it('handles empty text', () => {
        assert.equal(truncateMiddle('', 10), '')
    })

    it('splits evenly for even width', () => {
        // width 11, text 20 chars: 5 + … + 5 = 11
        const result = truncateMiddle('12345678901234567890', 11)
        assert.equal(result.length, 11)
        assert.ok(result.includes('…'))
    })
})
