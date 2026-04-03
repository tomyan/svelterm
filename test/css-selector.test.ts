import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSelector, parseSelector } from '../src/css/selector.js'
import { TermNode } from '../src/renderer/node.js'

describe('parseSelector', () => {
    it('parses a class selector', () => {
        const sel = parseSelector('.foo')
        assert.deepEqual(sel.classes, ['foo'])
        assert.equal(sel.tag, undefined)
    })

    it('parses an element selector', () => {
        const sel = parseSelector('div')
        assert.equal(sel.tag, 'div')
        assert.deepEqual(sel.classes, [])
    })

    it('parses tag+class', () => {
        const sel = parseSelector('div.container')
        assert.equal(sel.tag, 'div')
        assert.deepEqual(sel.classes, ['container'])
    })

    it('parses compound classes', () => {
        const sel = parseSelector('.foo.bar.svelte-abc')
        assert.deepEqual(sel.classes, ['foo', 'bar', 'svelte-abc'])
    })

    it('parses pseudo-class', () => {
        const sel = parseSelector('.btn:focus')
        assert.deepEqual(sel.classes, ['btn'])
        assert.equal(sel.pseudo, 'focus')
    })

    it('parses tag+class+pseudo', () => {
        const sel = parseSelector('button.primary:focus')
        assert.equal(sel.tag, 'button')
        assert.deepEqual(sel.classes, ['primary'])
        assert.equal(sel.pseudo, 'focus')
    })
})

describe('matchesSelector', () => {
    function makeElement(tag: string, classes?: string): TermNode {
        const node = new TermNode('element', tag)
        if (classes) node.attributes.set('class', classes)
        return node
    }

    describe('class selectors', () => {
        it('matches a single class', () => {
            assert.ok(matchesSelector(makeElement('div', 'foo'), '.foo'))
        })

        it('does not match a missing class', () => {
            assert.ok(!matchesSelector(makeElement('div', 'foo'), '.bar'))
        })

        it('matches one of multiple classes', () => {
            assert.ok(matchesSelector(makeElement('div', 'foo bar baz'), '.bar'))
        })

        it('matches compound class selector (all must be present)', () => {
            assert.ok(matchesSelector(makeElement('span', 'greeting svelte-abc'), '.greeting.svelte-abc'))
        })

        it('does not match compound if one class missing', () => {
            assert.ok(!matchesSelector(makeElement('span', 'greeting'), '.greeting.svelte-abc'))
        })
    })

    describe('element selectors', () => {
        it('matches tag name', () => {
            assert.ok(matchesSelector(makeElement('div'), 'div'))
        })

        it('does not match wrong tag', () => {
            assert.ok(!matchesSelector(makeElement('div'), 'span'))
        })

        it('matches tag+class', () => {
            assert.ok(matchesSelector(makeElement('div', 'foo'), 'div.foo'))
        })

        it('does not match tag+class when tag wrong', () => {
            assert.ok(!matchesSelector(makeElement('span', 'foo'), 'div.foo'))
        })

        it('does not match tag+class when class missing', () => {
            assert.ok(!matchesSelector(makeElement('div'), 'div.foo'))
        })
    })

    describe('pseudo-classes', () => {
        it('matches :focus when data-focused is true', () => {
            const node = makeElement('button', 'btn')
            node.attributes.set('data-focused', 'true')
            assert.ok(matchesSelector(node, '.btn:focus'))
        })

        it('does not match :focus when not focused', () => {
            assert.ok(!matchesSelector(makeElement('button', 'btn'), '.btn:focus'))
        })

        it('does not match unknown pseudo-class', () => {
            assert.ok(!matchesSelector(makeElement('div', 'foo'), '.foo:hover'))
        })
    })

    describe('non-element nodes', () => {
        it('text nodes never match', () => {
            const text = new TermNode('text', 'hello')
            assert.ok(!matchesSelector(text, 'text'))
        })

        it('comment nodes never match', () => {
            const comment = new TermNode('comment', 'x')
            assert.ok(!matchesSelector(comment, '.x'))
        })

        it('fragment nodes never match', () => {
            const frag = new TermNode('fragment')
            assert.ok(!matchesSelector(frag, 'fragment'))
        })
    })

    describe('elements without classes', () => {
        it('element with no class attribute does not match class selectors', () => {
            assert.ok(!matchesSelector(makeElement('div'), '.anything'))
        })

        it('element with empty class attribute does not match class selectors', () => {
            const node = makeElement('div')
            node.attributes.set('class', '')
            assert.ok(!matchesSelector(node, '.anything'))
        })
    })
})
