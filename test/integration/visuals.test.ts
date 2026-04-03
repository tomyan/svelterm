import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './harness.js'

describe('integration: borders and visuals', () => {

    it('rounded border has correct corners', () => {
        // Given
        const tree = el('div', { class: 'box' }, [text('X')])

        // When
        const { buffer } = render(tree, {
            css: '.box { border: rounded; width: 6cell; height: 3cell; }',
            width: 20, height: 5,
        })

        // Then
        assert.equal(buffer.getCell(0, 0)?.char, '╭')
        assert.equal(buffer.getCell(5, 0)?.char, '╮')
        assert.equal(buffer.getCell(0, 2)?.char, '╰')
        assert.equal(buffer.getCell(5, 2)?.char, '╯')
    })

    it('double border has correct corners', () => {
        // Given
        const tree = el('div', { class: 'box' }, [text('X')])

        // When
        const { buffer } = render(tree, {
            css: '.box { border: double; width: 6cell; height: 3cell; }',
            width: 20, height: 5,
        })

        // Then
        assert.equal(buffer.getCell(0, 0)?.char, '╔')
        assert.equal(buffer.getCell(5, 0)?.char, '╗')
    })

    it('heavy border has correct corners', () => {
        // Given
        const tree = el('div', { class: 'box' }, [text('X')])

        // When
        const { buffer } = render(tree, {
            css: '.box { border: heavy; width: 6cell; height: 3cell; }',
            width: 20, height: 5,
        })

        // Then
        assert.equal(buffer.getCell(0, 0)?.char, '┏')
        assert.equal(buffer.getCell(5, 0)?.char, '┓')
    })

    it('padding offsets content from border', () => {
        // Given
        const tree = el('div', { class: 'padded' }, [text('X')])

        // When
        const { buffer } = render(tree, {
            css: '.padded { border: single; padding: 1cell 2cell; width: 10cell; height: 5cell; }',
            width: 20, height: 7,
        })

        // Then: border at (0,0), content at (1+2, 1+1) = (3, 2)
        assert.equal(buffer.getCell(0, 0)?.char, '┌')
        assert.equal(buffer.getCell(3, 2)?.char, 'X')
    })

    it('overflow hidden clips text', () => {
        // Given: text wider than container
        const tree = el('div', { class: 'clip' }, [text('Hello World')])

        // When
        const { buffer } = render(tree, {
            css: '.clip { overflow: hidden; width: 5cell; height: 1cell; }',
            width: 20, height: 3,
        })

        // Then: only first 5 chars visible
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(4, 0)?.char, 'o')
        // Beyond container, text is clipped (space or not 'W')
        assert.notEqual(buffer.getCell(5, 0)?.char, 'W')
    })

    it('text-align center centers text within parent', () => {
        // Given
        const tree = el('div', { class: 'center' }, [text('Hi')])

        // When
        const { buffer } = render(tree, {
            css: '.center { text-align: center; width: 20cell; }',
            width: 20, height: 3,
        })

        // Then: "Hi" (2 chars) centered in 20 → starts at col 9
        assert.equal(buffer.getCell(9, 0)?.char, 'H')
        assert.equal(buffer.getCell(10, 0)?.char, 'i')
    })

    it('text-align right right-aligns text', () => {
        // Given
        const tree = el('div', { class: 'right' }, [text('Hi')])

        // When
        const { buffer } = render(tree, {
            css: '.right { text-align: right; width: 20cell; }',
            width: 20, height: 3,
        })

        // Then: "Hi" at far right
        assert.equal(buffer.getCell(18, 0)?.char, 'H')
        assert.equal(buffer.getCell(19, 0)?.char, 'i')
    })

    it('visibility hidden hides element but preserves space', () => {
        // Given
        const tree = el('div', {}, [
            el('div', { class: 'hidden' }, [text('Ghost')]),
            el('div', {}, [text('Visible')]),
        ])

        // When
        const { buffer, layout } = render(tree, {
            css: '.hidden { visibility: hidden; height: 2cell; }',
            width: 20, height: 5,
        })

        // Then: hidden element takes space (height 2), but text not painted
        assert.notEqual(buffer.getCell(0, 0)?.char, 'G')
        // Visible element starts after the hidden element's reserved space
        const visBox = layout.get(tree.children[1].id)!
        assert.equal(visBox.y, 2)
    })

    it('horizontal rule renders across width', () => {
        // Given
        const tree = el('div', { class: 'container' }, [
            el('hr', {}, []),
        ])

        // When
        const { buffer } = render(tree, {
            css: `.container { width: 10cell; }
                  hr { height: 1cell; width: 100%; }`,
            width: 20, height: 3,
        })

        // Then: hr fills the width with ─
        assert.equal(buffer.getCell(0, 0)?.char, '─')
        assert.equal(buffer.getCell(9, 0)?.char, '─')
    })
})
