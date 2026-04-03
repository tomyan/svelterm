import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text } from './harness.js'

describe('integration: grid layout', () => {

    it('basic 2-column grid positions children correctly', () => {
        // Given
        const tree = el('div', { class: 'grid' }, [
            el('div', {}, [text('A')]),
            el('div', {}, [text('B')]),
            el('div', {}, [text('C')]),
            el('div', {}, [text('D')]),
        ])

        // When
        const { layout } = render(tree, {
            css: '.grid { display: grid; grid-template-columns: 10cell 10cell; }',
            width: 30, height: 5,
        })

        // Then: 2x2 grid
        const a = layout.get(tree.children[0].id)!
        const b = layout.get(tree.children[1].id)!
        const c = layout.get(tree.children[2].id)!
        const d = layout.get(tree.children[3].id)!

        // Row 0: A at col 0, B at col 10
        assert.equal(a.x, b.x - 10)
        assert.equal(a.y, b.y)
        // Row 1: C at col 0, D at col 10
        assert.equal(c.x, d.x - 10)
        assert.ok(c.y > a.y, 'C should be below A')
    })

    it('fr units distribute space proportionally', () => {
        // Given
        const tree = el('div', { class: 'grid' }, [
            el('div', {}, [text('A')]),
            el('div', {}, [text('B')]),
        ])

        // When
        const { layout } = render(tree, {
            css: '.grid { display: grid; grid-template-columns: 1fr 2fr; width: 30cell; }',
            width: 30, height: 5,
        })

        // Then: 1fr=10, 2fr=20
        const a = layout.get(tree.children[0].id)!
        const b = layout.get(tree.children[1].id)!
        assert.equal(a.width, 10)
        assert.equal(b.width, 20)
    })

    it('grid with gap spaces cells', () => {
        // Given
        const tree = el('div', { class: 'grid' }, [
            el('div', {}, [text('A')]),
            el('div', {}, [text('B')]),
        ])

        // When
        const { layout } = render(tree, {
            css: '.grid { display: grid; grid-template-columns: 10cell 10cell; gap: 2cell; width: 22cell; }',
            width: 30, height: 5,
        })

        // Then: B starts at 10 + 2 gap = 12
        const b = layout.get(tree.children[1].id)!
        assert.equal(b.x, 12)
    })
})
