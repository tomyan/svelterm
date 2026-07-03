import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSelector } from '../src/css/selector.js'
import { TermNode } from '../src/renderer/node.js'

function makeElement(tag: string, attrs?: Record<string, string>): TermNode {
    const node = new TermNode('element', tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.attributes.set(k, v)
    return node
}

describe('attribute selector operators', () => {

    describe('[attr^=value] prefix match', () => {
        it('matches when the value starts with the operand', () => {
            assert.ok(matchesSelector(makeElement('a', { href: 'https://example.com' }), '[href^="https"]'))
        })

        it('does not match a different prefix', () => {
            assert.ok(!matchesSelector(makeElement('a', { href: 'http://example.com' }), '[href^="https"]'))
        })

        it('does not match when the attribute is absent', () => {
            assert.ok(!matchesSelector(makeElement('a'), '[href^="https"]'))
        })
    })

    describe('[attr$=value] suffix match', () => {
        it('matches when the value ends with the operand', () => {
            assert.ok(matchesSelector(makeElement('a', { href: 'report.pdf' }), '[href$=".pdf"]'))
        })

        it('does not match a different suffix', () => {
            assert.ok(!matchesSelector(makeElement('a', { href: 'report.txt' }), '[href$=".pdf"]'))
        })
    })

    describe('[attr*=value] substring match', () => {
        it('matches when the value contains the operand', () => {
            assert.ok(matchesSelector(makeElement('a', { href: '/docs/api/index' }), '[href*="api"]'))
        })

        it('does not match when absent from the value', () => {
            assert.ok(!matchesSelector(makeElement('a', { href: '/docs/guide' }), '[href*="api"]'))
        })
    })

    describe('[attr~=value] word match', () => {
        it('matches a whitespace-separated word', () => {
            assert.ok(matchesSelector(makeElement('div', { 'data-tags': 'alpha beta gamma' }), '[data-tags~="beta"]'))
        })

        it('does not match a partial word', () => {
            assert.ok(!matchesSelector(makeElement('div', { 'data-tags': 'alphabet' }), '[data-tags~="alpha"]'))
        })
    })

    describe('[attr|=value] dash match', () => {
        it('matches the exact value', () => {
            assert.ok(matchesSelector(makeElement('p', { lang: 'en' }), '[lang|="en"]'))
        })

        it('matches a dash-separated prefix', () => {
            assert.ok(matchesSelector(makeElement('p', { lang: 'en-GB' }), '[lang|="en"]'))
        })

        it('does not match a plain prefix without the dash', () => {
            assert.ok(!matchesSelector(makeElement('p', { lang: 'enx' }), '[lang|="en"]'))
        })
    })

    describe('unquoted and combined forms', () => {
        it('supports unquoted operands', () => {
            assert.ok(matchesSelector(makeElement('a', { href: 'x.pdf' }), '[href$=.pdf]'))
        })

        it('combines with tag and class', () => {
            assert.ok(matchesSelector(makeElement('a', { class: 'link', href: 'https://x' }), 'a.link[href^="https"]'))
            assert.ok(!matchesSelector(makeElement('a', { class: 'other', href: 'https://x' }), 'a.link[href^="https"]'))
        })

        it('exact match still works', () => {
            assert.ok(matchesSelector(makeElement('input', { type: 'text' }), '[type="text"]'))
            assert.ok(!matchesSelector(makeElement('input', { type: 'texting' }), '[type="text"]'))
        })
    })
})
