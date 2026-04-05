import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text } from './integration/harness.js'

describe('flex-basis', () => {

    it('flex-basis sets initial size before grow', () => {
        // Given: two items, one with basis 10, one with basis 20, both grow 1
        const tree = el('div', { class: 'row' }, [
            el('div', { class: 'a' }, [text('A')]),
            el('div', { class: 'b' }, [text('B')]),
        ])

        const { layout } = render(tree, {
            css: `.row { display: flex; flex-direction: row; width: 40cell; }
                  .a { flex: 1 1 10cell; }
                  .b { flex: 1 1 20cell; }`,
            width: 40, height: 3,
        })

        // Both have grow:1, so remaining 10 cells split equally
        // A: 10 + 5 = 15, B: 20 + 5 = 25
        const aBox = layout.get(tree.children[0].id)!
        const bBox = layout.get(tree.children[1].id)!
        assert.equal(aBox.width, 15)
        assert.equal(bBox.width, 25)
    })

    it('flex-basis: auto uses content size', () => {
        const tree = el('div', { class: 'row' }, [
            el('div', { class: 'a' }, [text('Hello')]),
            el('div', { class: 'b' }, [text('Hi')]),
        ])

        const { layout } = render(tree, {
            css: `.row { display: flex; flex-direction: row; width: 40cell; }
                  .a { flex-basis: auto; }
                  .b { flex-basis: auto; }`,
            width: 40, height: 3,
        })

        // auto basis = content size, no grow, so shrink-wrap
        const aBox = layout.get(tree.children[0].id)!
        const bBox = layout.get(tree.children[1].id)!
        assert.equal(aBox.width, 5) // "Hello"
        assert.equal(bBox.width, 2) // "Hi"
    })

    it('flex-basis property sets initial size', () => {
        const tree = el('div', { class: 'row' }, [
            el('div', { class: 'a' }, [text('A')]),
        ])

        const { layout } = render(tree, {
            css: `.row { display: flex; flex-direction: row; width: 40cell; }
                  .a { flex-basis: 20cell; }`,
            width: 40, height: 3,
        })

        const aBox = layout.get(tree.children[0].id)!
        assert.equal(aBox.width, 20)
    })
})
