import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { labelledControl } from '../src/input/label.js'
import { TermNode } from '../src/renderer/node.js'

function el(tag: string, attrs?: Record<string, string>, ...children: TermNode[]): TermNode {
    const node = new TermNode('element', tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.attributes.set(k, v)
    for (const child of children) node.insertBefore(child, null)
    return node
}

describe('labelledControl', () => {

    it('resolves the control wrapped inside the label', () => {
        // Given
        const input = el('input', { type: 'checkbox' })
        const label = el('label', {}, input, new TermNode('text', 'Subscribe'))

        // Then
        assert.equal(labelledControl(label), input)
    })

    it('resolves from a descendant of the label (the clicked span)', () => {
        // Given
        const input = el('input', { type: 'radio' })
        const span = el('span', {}, new TermNode('text', 'pro'))
        el('label', {}, input, span)

        // Then
        assert.equal(labelledControl(span), input)
    })

    it('resolves a control referenced by for=', () => {
        // Given
        const input = el('input', { id: 'agree' })
        const label = el('label', { for: 'agree' }, new TermNode('text', 'I agree'))
        el('root', {}, el('div', {}, input), label)

        // Then
        assert.equal(labelledControl(label), input)
    })

    it('returns null when the node is not inside a label', () => {
        const span = el('span')
        assert.equal(labelledControl(span), null)
    })

    it('returns null for a label with no control', () => {
        const label = el('label', {}, new TermNode('text', 'orphan'))
        assert.equal(labelledControl(label), null)
    })

    it('resolves selects and textareas too', () => {
        // Given
        const select = el('select', {}, el('option', {}, new TermNode('text', 'a')))
        const label = el('label', {}, new TermNode('text', 'Plan'), select)

        // Then
        assert.equal(labelledControl(label), select)
    })
})
