import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FocusManager } from '../src/input/focus.js'
import { TermNode } from '../src/renderer/node.js'

function makeButton(id: string, opts?: { disabled?: boolean }): TermNode {
    const node = new TermNode('element', 'button')
    node.attributes.set('data-id', id)
    if (opts?.disabled) node.attributes.set('disabled', '')
    return node
}

function focusedId(fm: FocusManager): string | undefined {
    return fm.focused?.attributes.get('data-id')
}

describe('FocusManager with disabled elements', () => {

    it('Tab skips a disabled element', () => {
        // Given
        const fm = new FocusManager()
        fm.register(makeButton('a'))
        fm.register(makeButton('b', { disabled: true }))
        fm.register(makeButton('c'))

        // When
        fm.focusNext()
        fm.focusNext()

        // Then
        assert.equal(focusedId(fm), 'c')
    })

    it('Shift-Tab skips a disabled element', () => {
        // Given
        const fm = new FocusManager()
        fm.register(makeButton('a'))
        fm.register(makeButton('b', { disabled: true }))
        fm.register(makeButton('c'))

        // When
        fm.focusNext()
        fm.focusPrevious()

        // Then
        assert.equal(focusedId(fm), 'c')
    })

    it('does nothing when every element is disabled', () => {
        // Given
        const fm = new FocusManager()
        fm.register(makeButton('a', { disabled: true }))
        fm.register(makeButton('b', { disabled: true }))

        // When
        fm.focusNext()

        // Then
        assert.equal(fm.focused, null)
    })

    it('skips an element disabled after registration', () => {
        // Given
        const fm = new FocusManager()
        fm.register(makeButton('a'))
        const b = makeButton('b')
        fm.register(b)
        b.attributes.set('disabled', '')

        // When
        fm.focusNext()
        fm.focusNext()

        // Then
        assert.equal(focusedId(fm), 'a')
    })

    it('focusByNode ignores a disabled element', () => {
        // Given
        const fm = new FocusManager()
        fm.register(makeButton('a'))
        const b = makeButton('b', { disabled: true })
        fm.register(b)
        fm.focusNext()

        // When
        fm.focusByNode(b)

        // Then
        assert.equal(focusedId(fm), 'a')
    })

    it('treats disabled="false" as focusable', () => {
        // Given
        const fm = new FocusManager()
        const a = makeButton('a')
        a.attributes.set('disabled', 'false')
        fm.register(a)

        // When
        fm.focusNext()

        // Then
        assert.equal(focusedId(fm), 'a')
    })
})
