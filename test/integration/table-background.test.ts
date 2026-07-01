import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text } from './harness.js'

describe('integration: table backgrounds', () => {

    it('background-color on a cell fills the whole cell box', () => {
        // Given
        const cell = el('td', {}, [text('Hi')])
        const tree = el('table', {}, [el('tr', {}, [cell])])

        // When
        const { buffer, layout } = render(tree, {
            css: 'td { background-color: red; }',
            width: 20, height: 5,
        })

        // Then: every cell of the td's box is red
        const box = layout.get(cell.id)!
        for (let col = box.x; col < box.x + box.width; col++) {
            assert.equal(buffer.getCell(col, box.y)?.bg, 'red', `cell at x=${col} should be red`)
        }
    })

    it('background-color on a row fills the full table width including column gaps', () => {
        // Given
        const tr = el('tr', {}, [
            el('td', {}, [text('A')]),
            el('td', {}, [text('B')]),
        ])
        const tree = el('table', {}, [tr])

        // When
        const { buffer, layout } = render(tree, {
            css: 'tr { background-color: blue; }',
            width: 20, height: 5,
        })

        // Then: the gap between the two cells is blue too
        const box = layout.get(tr.id)!
        for (let col = box.x; col < box.x + box.width; col++) {
            assert.equal(buffer.getCell(col, box.y)?.bg, 'blue', `cell at x=${col} should be blue`)
        }
    })

    it('background-color on thead fills all header rows', () => {
        // Given
        const thead = el('thead', {}, [
            el('tr', {}, [el('th', {}, [text('H1')])]),
            el('tr', {}, [el('th', {}, [text('H2')])]),
        ])
        const tree = el('table', {}, [
            thead,
            el('tbody', {}, [el('tr', {}, [el('td', {}, [text('B')])])]),
        ])

        // When
        const { buffer } = render(tree, {
            css: 'thead { background-color: green; }',
            width: 20, height: 5,
        })

        // Then: both header rows are green, the body row is not
        assert.equal(buffer.getCell(0, 0)?.bg, 'green', 'header row 1 should be green')
        assert.equal(buffer.getCell(0, 1)?.bg, 'green', 'header row 2 should be green')
        assert.notEqual(buffer.getCell(0, 2)?.bg, 'green', 'body row should not be green')
    })

    it('background-color on tbody covers its rows but not the header', () => {
        // Given
        const tree = el('table', {}, [
            el('thead', {}, [el('tr', {}, [el('th', {}, [text('H')])])]),
            el('tbody', {}, [
                el('tr', {}, [el('td', {}, [text('A')])]),
                el('tr', {}, [el('td', {}, [text('B')])]),
            ]),
        ])

        // When
        const { buffer } = render(tree, {
            css: 'tbody { background-color: magenta; }',
            width: 20, height: 5,
        })

        // Then
        assert.notEqual(buffer.getCell(0, 0)?.bg, 'magenta', 'header row should not be magenta')
        assert.equal(buffer.getCell(0, 1)?.bg, 'magenta', 'body row 1 should be magenta')
        assert.equal(buffer.getCell(0, 2)?.bg, 'magenta', 'body row 2 should be magenta')
    })
})
