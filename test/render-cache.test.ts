import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'

describe('RenderCache on TermNode', () => {

    it('new node has null cache fields', () => {
        const node = new TermNode('element', 'div')
        assert.equal(node.cache.resolvedStyle, null)
        assert.equal(node.cache.layoutBox, null)
        assert.equal(node.cache.contentSize, null)
        assert.equal(node.cache.classAttr, '')
    })

    it('cache fields are writable', () => {
        const node = new TermNode('element', 'div')
        node.cache.resolvedStyle = { fg: 'red' } as any
        node.cache.layoutBox = { x: 0, y: 0, width: 10, height: 5 }
        assert.equal(node.cache.resolvedStyle!.fg, 'red')
        assert.equal(node.cache.layoutBox.width, 10)
    })

    it('text node has cache too', () => {
        const node = new TermNode('text', 'hello')
        assert.equal(node.cache.resolvedStyle, null)
        assert.equal(node.cache.layoutBox, null)
    })

    it('invalidateStyle clears style cache', () => {
        const node = new TermNode('element', 'div')
        node.cache.resolvedStyle = { fg: 'red' } as any
        node.invalidateStyle()
        assert.equal(node.cache.resolvedStyle, null)
    })

    it('invalidateLayout clears layout cache', () => {
        const node = new TermNode('element', 'div')
        node.cache.layoutBox = { x: 0, y: 0, width: 10, height: 5 }
        node.cache.contentSize = { width: 10, height: 5 }
        node.invalidateLayout()
        assert.equal(node.cache.layoutBox, null)
        assert.equal(node.cache.contentSize, null)
    })

    it('invalidateAll clears everything', () => {
        const node = new TermNode('element', 'div')
        node.cache.resolvedStyle = { fg: 'red' } as any
        node.cache.layoutBox = { x: 0, y: 0, width: 10, height: 5 }
        node.invalidateAll()
        assert.equal(node.cache.resolvedStyle, null)
        assert.equal(node.cache.layoutBox, null)
    })
})
