import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { FocusManager } from '../src/input/focus.js'

describe('cleanup on node removal', () => {

    it('removing a node clears its listeners', () => {
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'button')
        child.listeners.set('click', new Set([() => {}]))
        parent.insertBefore(child, null)

        child.cleanup()
        assert.equal(child.listeners.size, 0)
    })

    it('removing a node clears its onMutate', () => {
        const node = new TermNode('text', 'hello')
        node.onMutate = () => {}
        node.cleanup()
        assert.equal(node.onMutate, undefined)
    })

    it('FocusManager.unregister removes node', () => {
        const fm = new FocusManager()
        const btn = new TermNode('element', 'button')
        fm.register(btn)
        assert.equal(fm.count, 1)
        fm.unregister(btn)
        assert.equal(fm.count, 0)
    })

    it('cleanup recursively cleans children', () => {
        const parent = new TermNode('element', 'div')
        const child = new TermNode('text', 'hello')
        child.onMutate = () => {}
        parent.insertBefore(child, null)

        parent.cleanup()
        assert.equal(child.onMutate, undefined)
    })
})
