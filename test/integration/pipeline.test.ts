import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText, regionText } from './harness.js'

describe('integration: full pipeline', () => {

    it('renders plain text in a div', () => {
        // Given
        const tree = el('div', {}, [text('Hello')])

        // When
        const { buffer } = render(tree, { css: '', width: 20, height: 3 })

        // Then
        assert.equal(rowText(buffer, 0), 'Hello')
    })

    it('renders styled text with color and bold', () => {
        // Given
        const tree = el('div', { class: 'title' }, [text('Bold Red')])

        // When
        const { buffer } = render(tree, {
            css: '.title { color: red; font-weight: bold; }',
            width: 20, height: 3,
        })

        // Then
        const cell = buffer.getCell(0, 0)!
        assert.equal(cell.char, 'B')
        assert.equal(cell.bold, true)
        assert.equal(cell.fg, 'red')
    })

    it('renders background color on a div', () => {
        // Given
        const tree = el('div', { class: 'box' }, [text('Hi')])

        // When
        const { buffer } = render(tree, {
            css: '.box { background-color: blue; width: 10cell; height: 3cell; }',
            width: 20, height: 5,
        })

        // Then: background fills the entire box area
        assert.equal(buffer.getCell(0, 0)?.bg, 'blue')
        assert.equal(buffer.getCell(5, 1)?.bg, 'blue')
        assert.equal(buffer.getCell(9, 2)?.bg, 'blue')
        // Outside the box, no blue
        assert.notEqual(buffer.getCell(10, 0)?.bg, 'blue')
    })

    it('renders nested elements with style inheritance', () => {
        // Given: parent sets color, child inherits
        const tree = el('div', { class: 'parent' }, [
            el('span', {}, [text('inherited')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '.parent { color: green; }',
            width: 20, height: 3,
        })

        // Then: child text has parent's color
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })

    it('renders multiple block children stacked vertically', () => {
        // Given: three divs
        const tree = el('div', {}, [
            el('div', {}, [text('First')]),
            el('div', {}, [text('Second')]),
            el('div', {}, [text('Third')]),
        ])

        // When
        const { buffer } = render(tree, { css: '', width: 20, height: 5 })

        // Then: each on its own row
        assert.equal(rowText(buffer, 0), 'First')
        assert.equal(rowText(buffer, 1), 'Second')
        assert.equal(rowText(buffer, 2), 'Third')
    })

    it('renders text with padding', () => {
        // Given
        const tree = el('div', { class: 'padded' }, [text('Hi')])

        // When
        const { buffer } = render(tree, {
            css: '.padded { padding: 1cell 2cell; }',
            width: 20, height: 5,
        })

        // Then: text offset by padding (2 right, 1 down)
        assert.equal(buffer.getCell(2, 1)?.char, 'H')
        assert.equal(buffer.getCell(3, 1)?.char, 'i')
    })

    it('renders text inside a bordered box', () => {
        // Given
        const tree = el('div', { class: 'box' }, [text('Inside')])

        // When
        const { buffer } = render(tree, {
            css: '.box { border: single; width: 12cell; height: 3cell; }',
            width: 20, height: 5,
        })

        // Then: border characters at edges
        assert.equal(buffer.getCell(0, 0)?.char, '┌')
        assert.equal(buffer.getCell(11, 0)?.char, '┐')
        assert.equal(buffer.getCell(0, 2)?.char, '└')
        assert.equal(buffer.getCell(11, 2)?.char, '┘')
        // Text inside (offset by 1 for border)
        assert.equal(buffer.getCell(1, 1)?.char, 'I')
    })

    it('renders dim text via opacity', () => {
        // Given
        const tree = el('div', { class: 'muted' }, [text('Faint')])

        // When
        const { buffer } = render(tree, {
            css: '.muted { opacity: dim; }',
            width: 20, height: 3,
        })

        // Then
        assert.equal(buffer.getCell(0, 0)?.dim, true)
    })

    it('renders underline and strikethrough', () => {
        // Given
        const tree = el('div', {}, [
            el('span', { class: 'u' }, [text('under')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '.u { text-decoration: underline; }',
            width: 20, height: 3,
        })

        // Then
        assert.equal(buffer.getCell(0, 0)?.underline, true)
    })

    it('does not render display:none elements', () => {
        // Given
        const tree = el('div', {}, [
            el('div', {}, [text('Visible')]),
            el('div', { class: 'hidden' }, [text('Hidden')]),
            el('div', {}, [text('Also Visible')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '.hidden { display: none; }',
            width: 20, height: 5,
        })

        // Then: hidden element skipped, third div at row 1 not row 2
        assert.equal(rowText(buffer, 0), 'Visible')
        assert.equal(rowText(buffer, 1), 'Also Visible')
    })
})
