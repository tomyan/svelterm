import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTermRenderer } from '../src/renderer/index.js'
import { TermNode } from '../src/renderer/node.js'

describe('createTermRenderer', () => {
    const renderer = createTermRenderer()

    describe('createElement', () => {
        it('creates an element node with the given tag', () => {
            const el = renderer.createElement('div')
            assert.equal(renderer.nodeType(el), 'element')
            assert.equal(el.tag, 'div')
        })
    })

    describe('createTextNode', () => {
        it('creates a text node with data', () => {
            const tn = renderer.createTextNode('hello')
            assert.equal(renderer.nodeType(tn), 'text')
            assert.equal(renderer.getNodeValue(tn), 'hello')
        })
    })

    describe('createComment', () => {
        it('creates a comment node', () => {
            const c = renderer.createComment('anchor')
            assert.equal(renderer.nodeType(c), 'comment')
            assert.equal(renderer.getNodeValue(c), 'anchor')
        })
    })

    describe('createFragment', () => {
        it('creates a fragment node', () => {
            const f = renderer.createFragment()
            assert.equal(renderer.nodeType(f), 'fragment')
            assert.equal(renderer.getNodeValue(f), null)
        })
    })

    describe('nodeType', () => {
        it('returns correct type for each node kind', () => {
            assert.equal(renderer.nodeType(renderer.createElement('p')), 'element')
            assert.equal(renderer.nodeType(renderer.createTextNode('x')), 'text')
            assert.equal(renderer.nodeType(renderer.createComment('c')), 'comment')
            assert.equal(renderer.nodeType(renderer.createFragment()), 'fragment')
        })
    })

    describe('getNodeValue', () => {
        it('returns text for text nodes', () => {
            assert.equal(renderer.getNodeValue(renderer.createTextNode('abc')), 'abc')
        })

        it('returns data for comment nodes', () => {
            assert.equal(renderer.getNodeValue(renderer.createComment('data')), 'data')
        })

        it('returns null for elements', () => {
            assert.equal(renderer.getNodeValue(renderer.createElement('div')), null)
        })

        it('returns null for fragments', () => {
            assert.equal(renderer.getNodeValue(renderer.createFragment()), null)
        })
    })

    describe('setAttribute / getAttribute / hasAttribute / removeAttribute', () => {
        it('sets and gets an attribute', () => {
            const el = renderer.createElement('div')
            renderer.setAttribute(el, 'class', 'foo bar')
            assert.equal(renderer.getAttribute(el, 'class'), 'foo bar')
        })

        it('returns null for missing attribute', () => {
            const el = renderer.createElement('div')
            assert.equal(renderer.getAttribute(el, 'id'), null)
        })

        it('hasAttribute returns true when present', () => {
            const el = renderer.createElement('div')
            renderer.setAttribute(el, 'data-x', '1')
            assert.ok(renderer.hasAttribute(el, 'data-x'))
        })

        it('hasAttribute returns false when absent', () => {
            const el = renderer.createElement('div')
            assert.ok(!renderer.hasAttribute(el, 'data-x'))
        })

        it('removeAttribute removes the attribute', () => {
            const el = renderer.createElement('div')
            renderer.setAttribute(el, 'class', 'foo')
            renderer.removeAttribute(el, 'class')
            assert.equal(renderer.getAttribute(el, 'class'), null)
            assert.ok(!renderer.hasAttribute(el, 'class'))
        })
    })

    describe('setText', () => {
        it('sets text on a text node', () => {
            const tn = renderer.createTextNode('old')
            renderer.setText(tn, 'new')
            assert.equal(tn.text, 'new')
        })

        it('sets text on an element (replaces children)', () => {
            const el = renderer.createElement('div')
            const child = renderer.createElement('span')
            renderer.insert(el, child, null)
            assert.equal(el.children.length, 1)

            renderer.setText(el, 'replaced')
            assert.equal(el.children.length, 1)
            assert.equal(el.children[0].nodeType, 'text')
            assert.equal(el.children[0].text, 'replaced')
        })
    })

    describe('tree traversal', () => {
        it('getFirstChild returns first child', () => {
            const parent = renderer.createElement('div')
            const a = renderer.createTextNode('a')
            const b = renderer.createTextNode('b')
            renderer.insert(parent, a, null)
            renderer.insert(parent, b, null)
            assert.equal(renderer.getFirstChild(parent), a)
        })

        it('getLastChild returns last child', () => {
            const parent = renderer.createElement('div')
            const a = renderer.createTextNode('a')
            const b = renderer.createTextNode('b')
            renderer.insert(parent, a, null)
            renderer.insert(parent, b, null)
            assert.equal(renderer.getLastChild(parent), b)
        })

        it('getNextSibling returns next sibling', () => {
            const parent = renderer.createElement('div')
            const a = renderer.createTextNode('a')
            const b = renderer.createTextNode('b')
            renderer.insert(parent, a, null)
            renderer.insert(parent, b, null)
            assert.equal(renderer.getNextSibling(a), b)
            assert.equal(renderer.getNextSibling(b), null)
        })

        it('getParent returns parent', () => {
            const parent = renderer.createElement('div')
            const child = renderer.createTextNode('x')
            renderer.insert(parent, child, null)
            assert.equal(renderer.getParent(child), parent)
        })

        it('getParent returns null for root', () => {
            const root = renderer.createElement('div')
            assert.equal(renderer.getParent(root), null)
        })

        it('getFirstChild returns null for empty element', () => {
            assert.equal(renderer.getFirstChild(renderer.createElement('div')), null)
        })

        it('getLastChild returns null for empty element', () => {
            assert.equal(renderer.getLastChild(renderer.createElement('div')), null)
        })
    })

    describe('insert and remove', () => {
        it('insert appends at end when anchor is null', () => {
            const parent = renderer.createElement('div')
            const a = renderer.createTextNode('a')
            const b = renderer.createTextNode('b')
            renderer.insert(parent, a, null)
            renderer.insert(parent, b, null)
            assert.equal(parent.children[0], a)
            assert.equal(parent.children[1], b)
        })

        it('insert before anchor', () => {
            const parent = renderer.createElement('div')
            const a = renderer.createTextNode('a')
            const b = renderer.createTextNode('b')
            renderer.insert(parent, a, null)
            renderer.insert(parent, b, a) // b before a
            assert.equal(parent.children[0], b)
            assert.equal(parent.children[1], a)
        })

        it('insert fragment expands children', () => {
            const parent = renderer.createElement('div')
            const frag = renderer.createFragment()
            const a = renderer.createTextNode('a')
            const b = renderer.createTextNode('b')
            renderer.insert(frag, a, null)
            renderer.insert(frag, b, null)
            renderer.insert(parent, frag, null)
            assert.equal(parent.children.length, 2)
            assert.equal(parent.children[0], a)
            assert.equal(renderer.getParent(a), parent)
        })

        it('remove detaches node from parent', () => {
            const parent = renderer.createElement('div')
            const child = renderer.createTextNode('x')
            renderer.insert(parent, child, null)
            renderer.remove(child)
            assert.equal(parent.children.length, 0)
            assert.equal(renderer.getParent(child), null)
        })

        it('remove is safe on unattached node', () => {
            const orphan = renderer.createTextNode('x')
            renderer.remove(orphan) // should not throw
        })
    })

    describe('addEventListener / removeEventListener', () => {
        it('adds a listener', () => {
            const el = renderer.createElement('button')
            const handler = () => {}
            renderer.addEventListener(el, 'click', handler)
            assert.ok(el.listeners.get('click')?.has(handler))
        })

        it('removes a listener', () => {
            const el = renderer.createElement('button')
            const handler = () => {}
            renderer.addEventListener(el, 'click', handler)
            renderer.removeEventListener(el, 'click', handler)
            assert.ok(!el.listeners.get('click')?.has(handler))
        })

        it('supports multiple listeners on same event', () => {
            const el = renderer.createElement('button')
            const h1 = () => {}
            const h2 = () => {}
            renderer.addEventListener(el, 'click', h1)
            renderer.addEventListener(el, 'click', h2)
            assert.equal(el.listeners.get('click')?.size, 2)
        })

        it('supports different event types', () => {
            const el = renderer.createElement('input')
            renderer.addEventListener(el, 'click', () => {})
            renderer.addEventListener(el, 'keydown', () => {})
            assert.ok(el.listeners.has('click'))
            assert.ok(el.listeners.has('keydown'))
        })
    })
})
