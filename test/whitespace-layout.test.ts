import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './integration/harness.js'
import { TermNode } from '../src/renderer/node.js'

describe('whitespace text node handling in layout', () => {

    it('whitespace between element siblings is collapsed (newline)', () => {
        // Given: Svelte template whitespace with newlines
        const tree = el('div', { class: 'col' }, [])
        tree.insertBefore(el('span', {}, [text('A')]), null)
        tree.insertBefore(new TermNode('text', '\n    '), null)
        tree.insertBefore(el('span', {}, [text('B')]), null)

        const { buffer } = render(tree, {
            css: '.col { display: flex; flex-direction: column; }',
            width: 20, height: 5,
        })

        // Then: no blank line between A and B
        assert.equal(rowText(buffer, 0), 'A')
        assert.equal(rowText(buffer, 1), 'B')
    })

    it('whitespace between element siblings is collapsed (single space)', () => {
        // Given: Svelte normalized whitespace (single space, no newline)
        const tree = el('div', { class: 'col' }, [])
        tree.insertBefore(el('span', {}, [text('A')]), null)
        tree.insertBefore(new TermNode('text', ' '), null)
        tree.insertBefore(el('span', {}, [text('B')]), null)

        const { buffer } = render(tree, {
            css: '.col { display: flex; flex-direction: column; }',
            width: 20, height: 5,
        })

        // Then: no blank line between A and B
        assert.equal(rowText(buffer, 0), 'A')
        assert.equal(rowText(buffer, 1), 'B')
    })

    it('whitespace between element siblings does not add flex gap', () => {
        // Given: flex column with gap, whitespace nodes between children
        const tree = el('div', { class: 'col' }, [])
        tree.insertBefore(el('div', {}, [text('First')]), null)
        tree.insertBefore(new TermNode('text', ' '), null)
        tree.insertBefore(el('div', {}, [text('Second')]), null)
        tree.insertBefore(new TermNode('text', ' '), null)
        tree.insertBefore(el('div', {}, [text('Third')]), null)

        const { buffer } = render(tree, {
            css: '.col { display: flex; flex-direction: column; gap: 1cell; }',
            width: 20, height: 10,
        })

        // Then: exactly 1 blank line between items (gap only, no whitespace rows)
        assert.equal(rowText(buffer, 0), 'First')
        assert.equal(rowText(buffer, 1), '')
        assert.equal(rowText(buffer, 2), 'Second')
        assert.equal(rowText(buffer, 3), '')
        assert.equal(rowText(buffer, 4), 'Third')
    })

    it('space-only text as sole child is preserved (game board row)', () => {
        // Given: a span containing only spaces (like a game grid row)
        const tree = el('div', { class: 'board' }, [])
        for (let i = 0; i < 3; i++) {
            tree.insertBefore(el('span', { class: 'row' }, [text('          ')]), null)
        }

        const { layout } = render(tree, {
            css: '.board { display: flex; flex-direction: column; } .row { display: block; }',
            width: 20, height: 10,
        })

        // Then: each row has height 1 (spaces preserved as content)
        for (const child of tree.children) {
            const textChild = child.children[0]
            const box = layout.get(textChild.id)!
            assert.equal(box.height, 1, `space-only text should have height 1`)
            assert.equal(box.width, 10, `space-only text should have width 10`)
        }
    })

    it('space-only text next to element siblings is collapsed', () => {
        // Given: a space text node alongside element siblings
        const tree = el('div', {}, [])
        tree.insertBefore(el('div', {}, [text('A')]), null)
        tree.insertBefore(new TermNode('text', '   '), null)
        tree.insertBefore(el('div', {}, [text('B')]), null)

        const { layout } = render(tree, { css: '', width: 20, height: 5 })

        // Then: the space text node has zero size
        const spaceNode = tree.children[1]
        const box = layout.get(spaceNode.id)!
        assert.equal(box.height, 0)
        assert.equal(box.width, 0)
    })
})
