import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { flattenTree, labelFor, type SerialNode } from '../src/devtools/client.js'

const tree: SerialNode = {
    nodeId: 1, nodeType: 'element', tag: 'root', children: [
        {
            nodeId: 2, nodeType: 'element', tag: 'div',
            attributes: { class: 'card wide', id: 'main' },
            children: [
                { nodeId: 3, nodeType: 'element', tag: 'span', children: [
                    { nodeId: 4, nodeType: 'text', text: 'Hello world', children: [] },
                ] },
            ],
        },
    ],
}

describe('labelFor', () => {

    it('labels an element with id and classes', () => {
        assert.equal(labelFor(tree.children[0]), '<div#main.card.wide>')
    })

    it('labels a plain element', () => {
        assert.equal(labelFor(tree), '<root>')
    })

    it('quotes and trims text nodes', () => {
        assert.equal(labelFor({ nodeId: 9, nodeType: 'text', text: '  Hello  ', children: [] }), '"Hello"')
    })

    it('marks whitespace-only text', () => {
        assert.equal(labelFor({ nodeId: 9, nodeType: 'text', text: '   ', children: [] }), '(whitespace)')
    })
})

describe('flattenTree', () => {

    it('produces depth-first rows with indentation depth', () => {
        // When
        const flat = flattenTree(tree)

        // Then
        assert.deepEqual(flat.map(f => [f.depth, f.label]), [
            [0, '<root>'],
            [1, '<div#main.card.wide>'],
            [2, '<span>'],
            [3, '"Hello world"'],
        ])
    })

    it('carries the original node on each row', () => {
        const flat = flattenTree(tree)
        assert.equal(flat[1].node.nodeId, 2)
    })

    it('flags nodes that have children', () => {
        const flat = flattenTree(tree)
        assert.equal(flat[0].hasChildren, true)   // root
        assert.equal(flat[3].hasChildren, false)  // text node
    })

    it('hides the subtree of a collapsed node', () => {
        // When: collapse the div (nodeId 2)
        const flat = flattenTree(tree, new Set([2]))

        // Then: root and div show, but the div's descendants don't
        assert.deepEqual(flat.map(f => f.node.nodeId), [1, 2])
        assert.equal(flat[1].collapsed, true)
    })
})
