import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSelector } from '../src/css/selector.js'
import { computeSpecificity } from '../src/css/specificity.js'
import { TermNode } from '../src/renderer/node.js'

function makeElement(tag: string, attrs?: Record<string, string>): TermNode {
    const node = new TermNode('element', tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.attributes.set(k, v)
    return node
}

function makeParentChild(parentTag: string, children: TermNode[]): TermNode {
    const parent = new TermNode('element', parentTag)
    for (const child of children) parent.insertBefore(child, null)
    return parent
}

describe('universal selector (*)', () => {
    it('matches any element', () => {
        assert.ok(matchesSelector(makeElement('div'), '*'))
        assert.ok(matchesSelector(makeElement('span'), '*'))
        assert.ok(matchesSelector(makeElement('button'), '*'))
    })

    it('does not match text nodes', () => {
        const text = new TermNode('text', 'hi')
        assert.ok(!matchesSelector(text, '*'))
    })

    it('has specificity (0,0,0)', () => {
        assert.deepEqual(computeSpecificity('*'), [0, 0, 0])
    })
})

describe('attribute selectors', () => {
    it('[attr] matches element with attribute present', () => {
        assert.ok(matchesSelector(makeElement('input', { type: 'text' }), '[type]'))
    })

    it('[attr] does not match element without attribute', () => {
        assert.ok(!matchesSelector(makeElement('input'), '[type]'))
    })

    it('[attr="value"] matches exact value', () => {
        assert.ok(matchesSelector(makeElement('input', { type: 'text' }), '[type="text"]'))
    })

    it('[attr="value"] does not match wrong value', () => {
        assert.ok(!matchesSelector(makeElement('input', { type: 'password' }), '[type="text"]'))
    })

    it('combined with element selector', () => {
        assert.ok(matchesSelector(makeElement('input', { type: 'text' }), 'input[type="text"]'))
        assert.ok(!matchesSelector(makeElement('div', { type: 'text' }), 'input[type="text"]'))
    })

    it('has specificity (0,1,0) per attribute', () => {
        assert.deepEqual(computeSpecificity('[type]'), [0, 1, 0])
        assert.deepEqual(computeSpecificity('[type="text"]'), [0, 1, 0])
    })
})

describe(':not() pseudo-class', () => {
    it('matches element that does not have class', () => {
        assert.ok(matchesSelector(makeElement('div'), ':not(.hidden)'))
    })

    it('does not match element that has class', () => {
        assert.ok(!matchesSelector(makeElement('div', { class: 'hidden' }), ':not(.hidden)'))
    })

    it('combined with element selector', () => {
        assert.ok(matchesSelector(makeElement('div'), 'div:not(.hidden)'))
        assert.ok(!matchesSelector(makeElement('span'), 'div:not(.hidden)'))
    })

    it(':not() specificity equals the argument specificity', () => {
        assert.deepEqual(computeSpecificity(':not(.foo)'), [0, 1, 0])
        assert.deepEqual(computeSpecificity(':not(#id)'), [1, 0, 0])
    })
})

describe(':first-child and :last-child', () => {
    it(':first-child matches first child of parent', () => {
        const first = makeElement('li')
        const second = makeElement('li')
        makeParentChild('ul', [first, second])
        assert.ok(matchesSelector(first, ':first-child'))
        assert.ok(!matchesSelector(second, ':first-child'))
    })

    it(':last-child matches last child of parent', () => {
        const first = makeElement('li')
        const second = makeElement('li')
        makeParentChild('ul', [first, second])
        assert.ok(!matchesSelector(first, ':last-child'))
        assert.ok(matchesSelector(second, ':last-child'))
    })

    it(':first-child does not match orphan', () => {
        assert.ok(!matchesSelector(makeElement('div'), ':first-child'))
    })

    it('combined: li:first-child', () => {
        const first = makeElement('li')
        const second = makeElement('li')
        makeParentChild('ul', [first, second])
        assert.ok(matchesSelector(first, 'li:first-child'))
    })
})

describe('sibling combinators', () => {
    it('+ matches adjacent sibling', () => {
        const a = makeElement('h1')
        const b = makeElement('p')
        makeParentChild('div', [a, b])
        assert.ok(matchesSelector(b, 'h1 + p'))
    })

    it('+ does not match non-adjacent', () => {
        const a = makeElement('h1')
        const mid = makeElement('div')
        const b = makeElement('p')
        makeParentChild('div', [a, mid, b])
        assert.ok(!matchesSelector(b, 'h1 + p'))
    })

    it('~ matches any following sibling', () => {
        const a = makeElement('h1')
        const mid = makeElement('div')
        const b = makeElement('p')
        makeParentChild('div', [a, mid, b])
        assert.ok(matchesSelector(b, 'h1 ~ p'))
    })

    it('~ does not match preceding sibling', () => {
        const a = makeElement('p')
        const b = makeElement('h1')
        makeParentChild('div', [a, b])
        assert.ok(!matchesSelector(a, 'h1 ~ p'))
    })
})
