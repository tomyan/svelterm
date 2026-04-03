import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

describe('@supports', () => {

    it('applies rules when property is supported', () => {
        const root = new TermNode('element', 'root')
        const css = '@supports (display: flex) { .t { color: cyan; } }'
        const sheet = parseCSS(css)
        const el = new TermNode('element', 'span')
        el.attributes.set('class', 't')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(el.id)?.fg, 'cyan')
    })

    it('does not apply rules when property is not supported', () => {
        const root = new TermNode('element', 'root')
        const css = '@supports (transform: rotate(45deg)) { .t { color: red; } }'
        const sheet = parseCSS(css)
        const el = new TermNode('element', 'span')
        el.attributes.set('class', 't')
        root.insertBefore(el, null)
        const styles = resolveStyles(root, sheet)
        assert.equal(styles.get(el.id)?.fg, 'default')
    })
})

describe('@import', () => {

    it('parses @import as a no-op (imports handled externally)', () => {
        // @import is typically resolved at build time by Vite/bundler
        // The parser should skip it without breaking
        const css = '@import url("other.css"); .t { color: cyan; }'
        const sheet = parseCSS(css)
        assert.equal(sheet.rules.length, 1)
        assert.deepEqual(sheet.rules[0].selectors, ['.t'])
    })
})
