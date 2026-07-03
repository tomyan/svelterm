import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSelector } from '../src/css/selector.js'
import { TermNode } from '../src/renderer/node.js'

function makeParentWithChildren(parentTag: string, childTags: string[]): TermNode[] {
    const parent = new TermNode('element', parentTag)
    const children = childTags.map(tag => new TermNode('element', tag))
    for (const child of children) parent.insertBefore(child, null)
    return children
}

function appendText(parent: TermNode, text: string): void {
    const node = new TermNode('text')
    node.text = text
    parent.insertBefore(node, null)
}

function appendComment(parent: TermNode): void {
    parent.insertBefore(new TermNode('comment'), null)
}

describe('structural pseudo-classes', () => {

    describe(':empty', () => {
        it('matches an element with no children', () => {
            // Given
            const div = new TermNode('element', 'div')

            // Then
            assert.ok(matchesSelector(div, ':empty'))
        })

        it('does not match an element with an element child', () => {
            // Given
            const div = new TermNode('element', 'div')
            div.insertBefore(new TermNode('element', 'span'), null)

            // Then
            assert.ok(!matchesSelector(div, ':empty'))
        })

        it('does not match an element with a text child', () => {
            // Given
            const div = new TermNode('element', 'div')
            appendText(div, 'hello')

            // Then
            assert.ok(!matchesSelector(div, ':empty'))
        })

        it('does not match an element with a whitespace-only text child', () => {
            // Given
            const div = new TermNode('element', 'div')
            appendText(div, '  ')

            // Then
            assert.ok(!matchesSelector(div, ':empty'))
        })

        it('ignores comment children', () => {
            // Given
            const div = new TermNode('element', 'div')
            appendComment(div)

            // Then
            assert.ok(matchesSelector(div, ':empty'))
        })

        it('ignores zero-length text children', () => {
            // Given
            const div = new TermNode('element', 'div')
            appendText(div, '')

            // Then
            assert.ok(matchesSelector(div, ':empty'))
        })
    })

    describe(':first-of-type and :last-of-type', () => {
        it('matches the first element of its tag among mixed siblings', () => {
            // Given
            const [, p1, p2] = makeParentWithChildren('div', ['h1', 'p', 'p'])

            // Then
            assert.ok(matchesSelector(p1, 'p:first-of-type'))
            assert.ok(!matchesSelector(p2, 'p:first-of-type'))
        })

        it('matches the last element of its tag among mixed siblings', () => {
            // Given
            const [, p1, p2] = makeParentWithChildren('div', ['h1', 'p', 'p'])

            // Then
            assert.ok(!matchesSelector(p1, 'p:last-of-type'))
            assert.ok(matchesSelector(p2, 'p:last-of-type'))
        })

        it('a sole element is both first and last of its type', () => {
            // Given
            const [h1] = makeParentWithChildren('div', ['h1', 'p'])

            // Then
            assert.ok(matchesSelector(h1, 'h1:first-of-type'))
            assert.ok(matchesSelector(h1, 'h1:last-of-type'))
        })
    })

    describe(':only-child', () => {
        it('matches a sole element child', () => {
            // Given
            const [only] = makeParentWithChildren('div', ['span'])

            // Then
            assert.ok(matchesSelector(only, ':only-child'))
        })

        it('does not match when there are element siblings', () => {
            // Given
            const [first] = makeParentWithChildren('div', ['span', 'span'])

            // Then
            assert.ok(!matchesSelector(first, ':only-child'))
        })

        it('text siblings do not prevent a match', () => {
            // Given
            const parent = new TermNode('element', 'div')
            appendText(parent, 'before')
            const span = new TermNode('element', 'span')
            parent.insertBefore(span, null)
            appendText(parent, 'after')

            // Then
            assert.ok(matchesSelector(span, ':only-child'))
        })
    })

    describe(':only-of-type', () => {
        it('matches when no sibling shares the tag', () => {
            // Given
            const [h1] = makeParentWithChildren('div', ['h1', 'p', 'p'])

            // Then
            assert.ok(matchesSelector(h1, 'h1:only-of-type'))
        })

        it('does not match when a sibling shares the tag', () => {
            // Given
            const [, p1] = makeParentWithChildren('div', ['h1', 'p', 'p'])

            // Then
            assert.ok(!matchesSelector(p1, 'p:only-of-type'))
        })
    })
})
