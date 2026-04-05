import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './integration/harness.js'

describe('display: contents', () => {

    it('children promoted to grandparent layout', () => {
        // Given: a wrapper div with display:contents between parent and children
        const tree = el('div', { class: 'parent' }, [
            el('div', { class: 'wrapper' }, [
                el('div', {}, [text('A')]),
                el('div', {}, [text('B')]),
            ]),
        ])

        const { buffer } = render(tree, {
            css: `.parent { display: flex; flex-direction: column; }
                  .wrapper { display: contents; }`,
            width: 20, height: 5,
        })

        // Then: A and B should be direct flex children of parent, stacked
        assert.equal(rowText(buffer, 0), 'A')
        assert.equal(rowText(buffer, 1), 'B')
    })

    it('contents element children appear at parent level in block flow', () => {
        // Given: two contents wrappers each with a child
        const tree = el('div', {}, [
            el('div', { class: 'w' }, [el('div', {}, [text('A')])]),
            el('div', { class: 'w' }, [el('div', {}, [text('B')])]),
        ])

        const { buffer } = render(tree, {
            css: '.w { display: contents; }',
            width: 20, height: 5,
        })

        // Then: A and B stack vertically as if they were direct children
        assert.equal(rowText(buffer, 0), 'A')
        assert.equal(rowText(buffer, 1), 'B')
    })
})
