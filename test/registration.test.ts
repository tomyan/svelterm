import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { FocusManager } from '../src/input/focus.js'

describe('focusable node registration', () => {

    it('does not duplicate when registered twice', () => {
        const fm = new FocusManager()
        const btn = new TermNode('element', 'button')
        fm.register(btn)
        fm.register(btn) // duplicate
        assert.equal(fm.count, 1)
    })
})

describe('mutation callback registration', () => {

    it('onMutate is idempotent — setting twice does not break', () => {
        const node = new TermNode('text', 'hello')
        let callCount = 0
        const callback = () => { callCount++ }
        node.onMutate = callback
        node.onMutate = callback // re-set same
        node.nodeValue = 'world'
        assert.equal(callCount, 1)
    })

    it('only newly inserted nodes need registration', () => {
        const root = new TermNode('element', 'div')
        const existing = new TermNode('text', 'old')
        existing.onMutate = () => {} // already registered
        root.insertBefore(existing, null)

        // New node inserted
        const newNode = new TermNode('text', 'new')
        root.insertBefore(newNode, null)

        // Only newNode needs onMutate set
        assert.ok(!newNode.onMutate, 'new node has no onMutate yet')
        assert.ok(existing.onMutate, 'existing node still has onMutate')
    })
})
