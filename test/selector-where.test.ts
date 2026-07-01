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

function makeParentChild(parentTag: string, parentAttrs: Record<string, string>, children: TermNode[]): TermNode {
    const parent = new TermNode('element', parentTag)
    for (const [k, v] of Object.entries(parentAttrs)) parent.attributes.set(k, v)
    for (const child of children) parent.insertBefore(child, null)
    return parent
}

describe(':where() pseudo-class', () => {
    it('matches when its argument matches', () => {
        assert.ok(matchesSelector(makeElement('th', { class: 'svelte-abc' }), 'th:where(.svelte-abc)'))
    })

    it('does not match when its argument does not match', () => {
        assert.ok(!matchesSelector(makeElement('th', { class: 'other' }), 'th:where(.svelte-abc)'))
    })

    it('matches when any item of a selector list matches', () => {
        assert.ok(matchesSelector(makeElement('th', { class: 'b' }), 'th:where(.a, .b)'))
        assert.ok(!matchesSelector(makeElement('th', { class: 'c' }), 'th:where(.a, .b)'))
    })

    it('contributes zero specificity', () => {
        assert.deepEqual(computeSpecificity('th:where(.svelte-abc)'), [0, 0, 1])
    })

    it('matches svelte-scoped descendant selectors', () => {
        // Given: the shape the Svelte compiler emits for `.data th`
        const th = makeElement('th', { class: 'svelte-x' })
        makeParentChild('table', { class: 'data svelte-x' }, [th])

        // Then
        assert.ok(matchesSelector(th, '.data.svelte-x th:where(.svelte-x)'))
    })

    it('combines with other pseudo-classes on the same compound', () => {
        // Given: the shape Svelte emits for `tbody td:first-child`
        const first = makeElement('td', { class: 'svelte-x' })
        const second = makeElement('td', { class: 'svelte-x' })
        makeParentChild('tr', {}, [first, second])

        // Then
        assert.ok(matchesSelector(first, 'td:first-child:where(.svelte-x)'))
        assert.ok(!matchesSelector(second, 'td:first-child:where(.svelte-x)'))
    })
})

describe(':is() pseudo-class', () => {
    it('matches when any item of a selector list matches', () => {
        assert.ok(matchesSelector(makeElement('th'), ':is(th, td)'))
        assert.ok(matchesSelector(makeElement('td'), ':is(th, td)'))
        assert.ok(!matchesSelector(makeElement('div'), ':is(th, td)'))
    })

    it('takes the specificity of its most specific argument', () => {
        assert.deepEqual(computeSpecificity(':is(th, .header)'), [0, 1, 0])
    })
})
