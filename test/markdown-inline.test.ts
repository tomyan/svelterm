import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseInline } from '../demo/markdown/parse.js'

describe('parseInline', () => {

    it('plain text is a single text span', () => {
        assert.deepEqual(parseInline('just words'), [{ kind: 'text', text: 'just words' }])
    })

    it('parses bold', () => {
        assert.deepEqual(parseInline('a **loud** word'), [
            { kind: 'text', text: 'a ' },
            { kind: 'bold', text: 'loud' },
            { kind: 'text', text: ' word' },
        ])
    })

    it('parses italic with asterisk and underscore', () => {
        assert.deepEqual(parseInline('*soft*'), [{ kind: 'italic', text: 'soft' }])
        assert.deepEqual(parseInline('_soft_'), [{ kind: 'italic', text: 'soft' }])
    })

    it('parses inline code', () => {
        assert.deepEqual(parseInline('run `svt`'), [
            { kind: 'text', text: 'run ' },
            { kind: 'code', text: 'svt' },
        ])
    })

    it('code protects markers inside it', () => {
        assert.deepEqual(parseInline('`a *b* c`'), [{ kind: 'code', text: 'a *b* c' }])
    })

    it('parses links with href', () => {
        assert.deepEqual(parseInline('see [the docs](https://example.com)!'), [
            { kind: 'text', text: 'see ' },
            { kind: 'link', text: 'the docs', href: 'https://example.com' },
            { kind: 'text', text: '!' },
        ])
    })

    it('unclosed markers stay literal', () => {
        assert.deepEqual(parseInline('a ** b'), [{ kind: 'text', text: 'a ** b' }])
    })

    it('mixes kinds left to right', () => {
        assert.deepEqual(parseInline('**a** then `b`').map(s => s.kind),
            ['bold', 'text', 'code'])
    })

    it('empty input yields no spans', () => {
        assert.deepEqual(parseInline(''), [])
    })
})
