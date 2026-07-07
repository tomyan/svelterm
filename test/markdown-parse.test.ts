import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkdown } from '../demo/markdown/parse.js'

describe('parseMarkdown blocks', () => {

    it('parses heading levels 1-3', () => {
        const blocks = parseMarkdown('# One\n## Two\n### Three\n')
        assert.deepEqual(blocks.map(b => b.type), ['heading', 'heading', 'heading'])
        assert.deepEqual(blocks.map(b => (b as any).level), [1, 2, 3])
        assert.equal((blocks[0] as any).text, 'One')
    })

    it('joins consecutive lines into one paragraph', () => {
        // Given
        const blocks = parseMarkdown('first line\nsecond line\n\nnext para\n')

        // Then
        assert.equal(blocks.length, 2)
        assert.deepEqual(blocks[0], { type: 'para', text: 'first line second line' })
        assert.deepEqual(blocks[1], { type: 'para', text: 'next para' })
    })

    it('parses fenced code blocks verbatim', () => {
        const blocks = parseMarkdown('```js\nconst x = 1\n\n  indented\n```\nafter\n')
        assert.deepEqual(blocks[0], {
            type: 'code', lang: 'js', lines: ['const x = 1', '', '  indented'],
        })
        assert.deepEqual(blocks[1], { type: 'para', text: 'after' })
    })

    it('an unterminated fence runs to the end', () => {
        const blocks = parseMarkdown('```\ncode\n')
        assert.deepEqual(blocks[0], { type: 'code', lang: '', lines: ['code'] })
    })

    it('parses unordered lists', () => {
        const blocks = parseMarkdown('- first\n- second\n* third\n')
        assert.deepEqual(blocks[0], {
            type: 'list', ordered: false, items: ['first', 'second', 'third'],
        })
    })

    it('parses ordered lists', () => {
        const blocks = parseMarkdown('1. one\n2. two\n10. ten\n')
        assert.deepEqual(blocks[0], {
            type: 'list', ordered: true, items: ['one', 'two', 'ten'],
        })
    })

    it('a non-list line ends the list', () => {
        const blocks = parseMarkdown('- item\nplain para\n')
        assert.equal(blocks[0].type, 'list')
        assert.deepEqual(blocks[1], { type: 'para', text: 'plain para' })
    })

    it('joins consecutive quote lines', () => {
        const blocks = parseMarkdown('> a wise\n> quotation\n')
        assert.deepEqual(blocks[0], { type: 'quote', text: 'a wise quotation' })
    })

    it('parses horizontal rules', () => {
        const blocks = parseMarkdown('above\n\n---\n\nbelow\n')
        assert.deepEqual(blocks.map(b => b.type), ['para', 'hr', 'para'])
    })

    it('ignores leading and trailing blank lines', () => {
        const blocks = parseMarkdown('\n\n# Title\n\n\n')
        assert.equal(blocks.length, 1)
    })

    it('parses an empty document to no blocks', () => {
        assert.deepEqual(parseMarkdown(''), [])
    })
})
