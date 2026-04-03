import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text } from './harness.js'

describe('integration: CSS cascade', () => {

    it('higher specificity wins over lower', () => {
        // Given: .highlight (class) vs div (tag) on same element
        const tree = el('div', { class: 'highlight' }, [text('Hi')])

        // When
        const { buffer } = render(tree, {
            css: `div { color: red; }
                  .highlight { color: green; }`,
            width: 20, height: 3,
        })

        // Then: class selector wins
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })

    it('later rule wins at equal specificity', () => {
        // Given: two class selectors
        const tree = el('div', { class: 'a b' }, [text('X')])

        // When
        const { buffer } = render(tree, {
            css: `.a { color: red; }
                  .b { color: blue; }`,
            width: 20, height: 3,
        })

        // Then: .b wins (later in source order)
        assert.equal(buffer.getCell(0, 0)?.fg, 'blue')
    })

    it('child inherits color from parent', () => {
        // Given
        const tree = el('div', { class: 'parent' }, [
            el('span', {}, [text('child')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '.parent { color: cyan; }',
            width: 20, height: 3,
        })

        // Then
        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
    })

    it('child can override inherited color', () => {
        // Given
        const tree = el('div', { class: 'parent' }, [
            el('span', { class: 'child' }, [text('own')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: `.parent { color: cyan; }
                  .child { color: yellow; }`,
            width: 20, height: 3,
        })

        // Then: child's own color overrides inherited
        assert.equal(buffer.getCell(0, 0)?.fg, 'yellow')
    })

    it('CSS variables resolve via var()', () => {
        // Given
        const tree = el('div', { class: 'root' }, [
            el('span', { class: 'themed' }, [text('V')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: `.root { --accent: magenta; }
                  .themed { color: var(--accent); }`,
            width: 20, height: 3,
        })

        // Then
        assert.equal(buffer.getCell(0, 0)?.fg, 'magenta')
    })

    it('CSS variable with fallback', () => {
        // Given: var(--missing, red)
        const tree = el('div', { class: 'fb' }, [text('F')])

        // When
        const { buffer } = render(tree, {
            css: '.fb { color: var(--missing, red); }',
            width: 20, height: 3,
        })

        // Then: falls back to red
        assert.equal(buffer.getCell(0, 0)?.fg, 'red')
    })

    it('ID selector has higher specificity than class', () => {
        // Given
        const tree = el('div', { class: 'cls', id: 'myid' }, [text('I')])

        // When
        const { buffer } = render(tree, {
            css: `.cls { color: red; }
                  #myid { color: green; }`,
            width: 20, height: 3,
        })

        // Then: ID wins
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })

    it('descendant selector matches nested elements', () => {
        // Given
        const tree = el('div', { class: 'outer' }, [
            el('div', { class: 'inner' }, [
                el('span', {}, [text('deep')]),
            ]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '.outer span { color: yellow; }',
            width: 20, height: 3,
        })

        // Then: descendant combinator matches
        assert.equal(buffer.getCell(0, 0)?.fg, 'yellow')
    })

    it(':first-child pseudo-class matches', () => {
        // Given
        const tree = el('div', {}, [
            el('span', {}, [text('first')]),
            el('span', {}, [text('second')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: 'span:first-child { color: green; }',
            width: 20, height: 3,
        })

        // Then: only first span is green
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
        // Second span on row 1 should not be green
        assert.notEqual(buffer.getCell(0, 1)?.fg, 'green')
    })
})
