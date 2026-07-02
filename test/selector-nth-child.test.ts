import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSelector } from '../src/css/selector.js'
import { computeSpecificity } from '../src/css/specificity.js'
import { TermNode } from '../src/renderer/node.js'

function makeChildren(parentTag: string, tags: string[]): TermNode[] {
    const parent = new TermNode('element', parentTag)
    const children = tags.map(tag => new TermNode('element', tag))
    for (const child of children) parent.insertBefore(child, null)
    return children
}

describe(':nth-child() pseudo-class', () => {

    it('matches a 1-based index', () => {
        // Given
        const rows = makeChildren('tbody', ['tr', 'tr', 'tr'])

        // Then
        assert.ok(matchesSelector(rows[0], 'tr:nth-child(1)'))
        assert.ok(!matchesSelector(rows[1], 'tr:nth-child(1)'))
        assert.ok(matchesSelector(rows[2], 'tr:nth-child(3)'))
    })

    it('odd matches the 1st, 3rd, 5th children', () => {
        // Given
        const rows = makeChildren('tbody', ['tr', 'tr', 'tr', 'tr'])

        // Then
        assert.ok(matchesSelector(rows[0], 'tr:nth-child(odd)'))
        assert.ok(!matchesSelector(rows[1], 'tr:nth-child(odd)'))
        assert.ok(matchesSelector(rows[2], 'tr:nth-child(odd)'))
        assert.ok(!matchesSelector(rows[3], 'tr:nth-child(odd)'))
    })

    it('even matches the 2nd, 4th children', () => {
        // Given
        const rows = makeChildren('tbody', ['tr', 'tr', 'tr', 'tr'])

        // Then
        assert.ok(!matchesSelector(rows[0], 'tr:nth-child(even)'))
        assert.ok(matchesSelector(rows[1], 'tr:nth-child(even)'))
        assert.ok(!matchesSelector(rows[2], 'tr:nth-child(even)'))
        assert.ok(matchesSelector(rows[3], 'tr:nth-child(even)'))
    })

    it('An+B forms match arithmetic progressions', () => {
        // Given
        const items = makeChildren('ul', ['li', 'li', 'li', 'li', 'li', 'li'])

        // Then: 3n+1 → 1, 4
        assert.ok(matchesSelector(items[0], 'li:nth-child(3n+1)'))
        assert.ok(!matchesSelector(items[1], 'li:nth-child(3n+1)'))
        assert.ok(matchesSelector(items[3], 'li:nth-child(3n+1)'))
        // 2n → 2, 4, 6
        assert.ok(matchesSelector(items[1], 'li:nth-child(2n)'))
        assert.ok(!matchesSelector(items[2], 'li:nth-child(2n)'))
        assert.ok(matchesSelector(items[5], 'li:nth-child(2n)'))
        // -n+3 → 1, 2, 3 only
        assert.ok(matchesSelector(items[0], 'li:nth-child(-n+3)'))
        assert.ok(matchesSelector(items[2], 'li:nth-child(-n+3)'))
        assert.ok(!matchesSelector(items[3], 'li:nth-child(-n+3)'))
    })

    it('index counts element siblings only, ignoring text nodes', () => {
        // Given: text nodes interleaved between rows
        const parent = new TermNode('element', 'tbody')
        const first = new TermNode('element', 'tr')
        const second = new TermNode('element', 'tr')
        parent.insertBefore(new TermNode('text', ' '), null)
        parent.insertBefore(first, null)
        parent.insertBefore(new TermNode('text', ' '), null)
        parent.insertBefore(second, null)

        // Then
        assert.ok(matchesSelector(first, 'tr:nth-child(1)'))
        assert.ok(matchesSelector(second, 'tr:nth-child(2)'))
    })

    it('does not match an element with no parent', () => {
        assert.ok(!matchesSelector(new TermNode('element', 'div'), 'div:nth-child(1)'))
    })

    it('combines with :where on the same compound (svelte scoping shape)', () => {
        // Given
        const rows = makeChildren('tbody', ['tr', 'tr'])
        rows[1].attributes.set('class', 'svelte-x')

        // Then
        assert.ok(matchesSelector(rows[1], 'tr:nth-child(even):where(.svelte-x)'))
        assert.ok(!matchesSelector(rows[0], 'tr:nth-child(even):where(.svelte-x)'))
    })

    it('has class-level specificity', () => {
        assert.deepEqual(computeSpecificity('tr:nth-child(2n)'), [0, 1, 1])
    })
})

describe(':nth-last-child() pseudo-class', () => {

    it('counts from the end', () => {
        // Given
        const rows = makeChildren('tbody', ['tr', 'tr', 'tr'])

        // Then
        assert.ok(matchesSelector(rows[2], 'tr:nth-last-child(1)'))
        assert.ok(matchesSelector(rows[1], 'tr:nth-last-child(2)'))
        assert.ok(!matchesSelector(rows[0], 'tr:nth-last-child(1)'))
    })

    it('supports odd from the end', () => {
        // Given
        const rows = makeChildren('tbody', ['tr', 'tr', 'tr', 'tr'])

        // Then: odd from the end = 4th and 2nd
        assert.ok(matchesSelector(rows[3], 'tr:nth-last-child(odd)'))
        assert.ok(!matchesSelector(rows[2], 'tr:nth-last-child(odd)'))
        assert.ok(matchesSelector(rows[1], 'tr:nth-last-child(odd)'))
    })
})

describe(':nth-of-type() pseudo-classes', () => {

    it('nth-of-type counts only same-tag siblings', () => {
        // Given: h1, p, p, p — the second <p> is nth-of-type(2)
        const children = makeChildren('div', ['h1', 'p', 'p', 'p'])

        // Then
        assert.ok(matchesSelector(children[1], 'p:nth-of-type(1)'))
        assert.ok(matchesSelector(children[2], 'p:nth-of-type(2)'))
        assert.ok(!matchesSelector(children[2], 'p:nth-of-type(1)'))
        assert.ok(matchesSelector(children[0], 'h1:nth-of-type(1)'))
    })

    it('nth-last-of-type counts same-tag siblings from the end', () => {
        // Given
        const children = makeChildren('div', ['p', 'p', 'span'])

        // Then: the second <p> is the last of its type
        assert.ok(matchesSelector(children[1], 'p:nth-last-of-type(1)'))
        assert.ok(matchesSelector(children[0], 'p:nth-last-of-type(2)'))
        assert.ok(matchesSelector(children[2], 'span:nth-last-of-type(1)'))
    })
})
