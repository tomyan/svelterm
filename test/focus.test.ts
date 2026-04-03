import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FocusManager } from '../src/input/focus.js'
import { TermNode } from '../src/renderer/node.js'

function makeButton(id: string): TermNode {
    const node = new TermNode('element', 'button')
    node.attributes.set('data-id', id)
    return node
}

describe('FocusManager', () => {

    it('starts with no focused element', () => {
        const fm = new FocusManager()
        assert.equal(fm.focused, null)
    })

    it('registers focusable elements', () => {
        const fm = new FocusManager()
        const btn = makeButton('a')
        fm.register(btn)
        assert.equal(fm.count, 1)
    })

    it('Tab focuses first element when nothing focused', () => {
        const fm = new FocusManager()
        fm.register(makeButton('a'))
        fm.register(makeButton('b'))
        fm.focusNext()
        assert.equal(fm.focused?.attributes.get('data-id'), 'a')
    })

    it('Tab advances to next element', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        const b = makeButton('b')
        fm.register(a)
        fm.register(b)
        fm.focusNext()
        fm.focusNext()
        assert.equal(fm.focused, b)
    })

    it('Tab wraps around to first element', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        const b = makeButton('b')
        fm.register(a)
        fm.register(b)
        fm.focusNext()
        fm.focusNext()
        fm.focusNext()
        assert.equal(fm.focused, a)
    })

    it('Shift+Tab goes to previous element', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        const b = makeButton('b')
        fm.register(a)
        fm.register(b)
        fm.focusNext() // a
        fm.focusNext() // b
        fm.focusPrevious() // a
        assert.equal(fm.focused, a)
    })

    it('Shift+Tab wraps to last element', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        const b = makeButton('b')
        fm.register(a)
        fm.register(b)
        fm.focusNext() // a
        fm.focusPrevious() // wraps to b
        assert.equal(fm.focused, b)
    })

    it('unregister removes element from cycle', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        const b = makeButton('b')
        fm.register(a)
        fm.register(b)
        fm.unregister(a)
        fm.focusNext()
        assert.equal(fm.focused, b)
        assert.equal(fm.count, 1)
    })

    it('unregistering focused element clears focus', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        fm.register(a)
        fm.focusNext()
        assert.equal(fm.focused, a)
        fm.unregister(a)
        assert.equal(fm.focused, null)
    })

    it('clearFocus removes focus', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        fm.register(a)
        fm.focusNext()
        fm.clearFocus()
        assert.equal(fm.focused, null)
    })

    it('focusNext with no registered elements does nothing', () => {
        const fm = new FocusManager()
        fm.focusNext()
        assert.equal(fm.focused, null)
    })

    it('sets data-focused attribute on focused node', () => {
        const fm = new FocusManager()
        const a = makeButton('a')
        const b = makeButton('b')
        fm.register(a)
        fm.register(b)
        fm.focusNext()
        assert.equal(a.attributes.get('data-focused'), 'true')
        assert.equal(b.attributes.has('data-focused'), false)
        fm.focusNext()
        assert.equal(a.attributes.has('data-focused'), false)
        assert.equal(b.attributes.get('data-focused'), 'true')
    })
})
