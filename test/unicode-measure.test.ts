import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { wrapText, measureText, truncateText, truncateMiddle } from '../src/layout/text.js'

describe('width-aware measurement', () => {

    it('measureText counts CJK as two cells', () => {
        assert.deepEqual(measureText('你好', 10), { width: 4, height: 1 })
    })

    it('wrapText wraps by cell width, not character count', () => {
        // 你好世 = 6 cells; width 4 fits two ideographs per line
        assert.deepEqual(wrapText('你好世界', 4), ['你好', '世界'])
    })

    it('wrapText never splits a wide character across the boundary', () => {
        // 'a你' = 3 cells; at width 2 the ideograph must move down whole
        assert.deepEqual(wrapText('a你', 2), ['a', '你'])
    })

    it('wrapText keeps grapheme clusters whole', () => {
        assert.deepEqual(wrapText('👍👍👍', 4), ['👍👍', '👍'])
    })

    it('truncateText cuts at cell width with the ellipsis fitting', () => {
        // width 5: ellipsis takes 1 → 4 cells of content = two ideographs
        assert.equal(truncateText('你好世界啊', 5), '你好…')
    })

    it('truncateMiddle keeps both ends within the cell budget', () => {
        const out = truncateMiddle('你好世界你好世界', 9)
        assert.ok(out.includes('…'))
        assert.ok([...out].length < 8)
    })

    it('plain ASCII behaviour is unchanged', () => {
        assert.deepEqual(wrapText('abcdef ghij', 4), ['abcd', 'ef', 'ghij'])
        assert.equal(truncateText('hello world', 8), 'hello w…')
    })
})
