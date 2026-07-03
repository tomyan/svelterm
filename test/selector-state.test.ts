import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSelector } from '../src/css/selector.js'
import { TermNode } from '../src/renderer/node.js'

function makeElement(tag: string, attrs?: Record<string, string>): TermNode {
    const node = new TermNode('element', tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.attributes.set(k, v)
    return node
}

describe('state pseudo-classes', () => {

    describe(':checked', () => {
        it('matches an input with the checked attribute', () => {
            assert.ok(matchesSelector(makeElement('input', { type: 'checkbox', checked: '' }), ':checked'))
        })

        it('does not match an input without the checked attribute', () => {
            assert.ok(!matchesSelector(makeElement('input', { type: 'checkbox' }), ':checked'))
        })

        it('treats checked="false" as unchecked (stringified Svelte boolean)', () => {
            assert.ok(!matchesSelector(makeElement('input', { type: 'checkbox', checked: 'false' }), ':checked'))
        })
    })

    describe(':disabled', () => {
        it('matches a button with the disabled attribute', () => {
            assert.ok(matchesSelector(makeElement('button', { disabled: '' }), ':disabled'))
        })

        it('matches an input with disabled="true"', () => {
            assert.ok(matchesSelector(makeElement('input', { disabled: 'true' }), ':disabled'))
        })

        it('does not match a button without the disabled attribute', () => {
            assert.ok(!matchesSelector(makeElement('button'), ':disabled'))
        })

        it('treats disabled="false" as enabled (stringified Svelte boolean)', () => {
            assert.ok(!matchesSelector(makeElement('button', { disabled: 'false' }), ':disabled'))
        })

        it('does not match a non-form element with a disabled attribute', () => {
            assert.ok(!matchesSelector(makeElement('div', { disabled: '' }), ':disabled'))
        })
    })

    describe(':enabled', () => {
        it('matches a form control without the disabled attribute', () => {
            assert.ok(matchesSelector(makeElement('button'), ':enabled'))
            assert.ok(matchesSelector(makeElement('input'), ':enabled'))
        })

        it('does not match a disabled form control', () => {
            assert.ok(!matchesSelector(makeElement('button', { disabled: '' }), ':enabled'))
        })

        it('does not match a non-form element', () => {
            assert.ok(!matchesSelector(makeElement('div'), ':enabled'))
        })
    })
})
