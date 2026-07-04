import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { graphemes, charWidth, stringWidth } from '../src/layout/unicode.js'

describe('graphemes', () => {

    it('splits ASCII per character', () => {
        assert.deepEqual(graphemes('abc'), ['a', 'b', 'c'])
    })

    it('keeps surrogate-pair emoji as one grapheme', () => {
        assert.deepEqual(graphemes('a👍b'), ['a', '👍', 'b'])
    })

    it('keeps ZWJ sequences as one grapheme', () => {
        assert.deepEqual(graphemes('👩‍👩‍👧'), ['👩‍👩‍👧'])
    })

    it('keeps combining marks attached to their base', () => {
        assert.deepEqual(graphemes('éx'), ['é', 'x'])
    })
})

describe('charWidth', () => {

    it('ASCII is 1 cell', () => {
        assert.equal(charWidth('a'), 1)
        assert.equal(charWidth(' '), 1)
    })

    it('CJK is 2 cells', () => {
        assert.equal(charWidth('你'), 2)
        assert.equal(charWidth('ア'), 2)
        assert.equal(charWidth('한'), 2)
    })

    it('emoji are 2 cells', () => {
        assert.equal(charWidth('👍'), 2)
        assert.equal(charWidth('👩‍👩‍👧'), 2)
    })

    it('combining sequences take their base width', () => {
        assert.equal(charWidth('é'), 1)
    })

    it('zero-width characters are 0', () => {
        assert.equal(charWidth('​'), 0)
    })

    it('fullwidth forms are 2 cells', () => {
        assert.equal(charWidth('Ａ'), 2)
    })
})

describe('stringWidth', () => {

    it('sums grapheme widths', () => {
        assert.equal(stringWidth('abc'), 3)
        assert.equal(stringWidth('你好'), 4)
        assert.equal(stringWidth('a你b'), 4)
        assert.equal(stringWidth('👍👍'), 4)
        assert.equal(stringWidth(''), 0)
    })
})
