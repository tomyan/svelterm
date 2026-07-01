import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './harness.js'

const COLLAPSE_CSS = 'table { border-collapse: collapse; } td, th { border: single; }'

describe('integration: table border-collapse', () => {

    it('collapse: adjacent bordered cells share a vertical border line', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('A')]), el('td', {}, [text('B')])]),
        ])

        // When
        const { buffer } = render(tree, { css: COLLAPSE_CSS, width: 20, height: 5 })

        // Then
        assert.equal(rowText(buffer, 0), '┌─┬─┐')
        assert.equal(rowText(buffer, 1), '│A│B│')
        assert.equal(rowText(buffer, 2), '└─┴─┘')
    })

    it('collapse: bordered cells in adjacent rows share a horizontal line', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('A')])]),
            el('tr', {}, [el('td', {}, [text('B')])]),
        ])

        // When
        const { buffer } = render(tree, { css: COLLAPSE_CSS, width: 20, height: 6 })

        // Then
        assert.equal(rowText(buffer, 0), '┌─┐')
        assert.equal(rowText(buffer, 1), '│A│')
        assert.equal(rowText(buffer, 2), '├─┤')
        assert.equal(rowText(buffer, 3), '│B│')
        assert.equal(rowText(buffer, 4), '└─┘')
    })

    it('collapse: 2x2 grid produces a cross junction', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('A')]), el('td', {}, [text('B')])]),
            el('tr', {}, [el('td', {}, [text('C')]), el('td', {}, [text('D')])]),
        ])

        // When
        const { buffer } = render(tree, { css: COLLAPSE_CSS, width: 20, height: 6 })

        // Then
        assert.equal(rowText(buffer, 0), '┌─┬─┐')
        assert.equal(rowText(buffer, 1), '│A│B│')
        assert.equal(rowText(buffer, 2), '├─┼─┤')
        assert.equal(rowText(buffer, 3), '│C│D│')
        assert.equal(rowText(buffer, 4), '└─┴─┘')
    })

    it('collapse: a colspan cell below two cells keeps the upper junction', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('A')]), el('td', {}, [text('B')])]),
            el('tr', {}, [el('td', { colspan: '2' }, [text('C')])]),
        ])

        // When
        const { buffer } = render(tree, { css: COLLAPSE_CSS, width: 20, height: 6 })

        // Then: the vertical line above ends in a ┴ on the shared edge
        assert.equal(rowText(buffer, 0), '┌─┬─┐')
        assert.equal(rowText(buffer, 1), '│A│B│')
        assert.equal(rowText(buffer, 2), '├─┴─┤')
        assert.equal(rowText(buffer, 3), '│C  │')
        assert.equal(rowText(buffer, 4), '└───┘')
    })

    it('collapse: a rowspan cell beside two rows produces tee junctions on its edge', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [el('td', { rowspan: '2' }, [text('S')]), el('td', {}, [text('X')])]),
            el('tr', {}, [el('td', {}, [text('Y')])]),
        ])

        // When
        const { buffer } = render(tree, { css: COLLAPSE_CSS, width: 20, height: 6 })

        // Then: the X/Y divider meets the rowspan cell's right edge in a ├
        assert.equal(rowText(buffer, 0), '┌─┬─┐')
        assert.equal(rowText(buffer, 1), '│S│X│')
        assert.equal(rowText(buffer, 2), '│ ├─┤')
        assert.equal(rowText(buffer, 3), '│ │Y│')
        assert.equal(rowText(buffer, 4), '└─┴─┘')
    })

    it('collapse: bottom-only borders draw row separators without overlapping tracks', () => {
        // Given: the header-underline / row-separator pattern from the browser demo
        const cellA = el('td', {}, [text('AA')])
        const cellB = el('td', {}, [text('BB')])
        const tree = el('table', {}, [
            el('tr', {}, [cellA]),
            el('tr', {}, [cellB]),
        ])

        // When
        const { buffer, layout } = render(tree, {
            css: 'table { border-collapse: collapse; } td { border-style: single; border-bottom: true; }',
            width: 20, height: 6,
        })

        // Then: each row is content plus its own separator line, no overlap
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxB.y, boxA.y + boxA.height, 'rows should abut, not overlap')
        assert.equal(rowText(buffer, 0), 'AA')
        assert.equal(rowText(buffer, 1), '──')
        assert.equal(rowText(buffer, 2), 'BB')
        assert.equal(rowText(buffer, 3), '──')
    })

    it('collapse: unbordered cells abut with no gap', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('table', {}, [el('tr', {}, [cellA, cellB])])

        // When
        const { layout } = render(tree, {
            css: 'table { border-collapse: collapse; }',
            width: 20, height: 5,
        })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxB.x, boxA.x + boxA.width, 'cells should abut with no gap and no overlap')
    })

    it('separate (default): bordered cells keep distinct borders', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('A')]), el('td', {}, [text('B')])]),
        ])

        // When
        const { buffer } = render(tree, {
            css: 'td { border: single; }',
            width: 20, height: 5,
        })

        // Then: two complete boxes separated by the default gap
        assert.equal(rowText(buffer, 0), '┌─┐  ┌─┐')
        assert.equal(rowText(buffer, 1), '│A│  │B│')
        assert.equal(rowText(buffer, 2), '└─┘  └─┘')
    })
})

describe('integration: empty-cells', () => {

    it('empty-cells: hide skips border and background on cells with no content', () => {
        // Given
        const emptyCell = el('td')
        const tree = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('A')]), emptyCell]),
        ])

        // When
        const { buffer, layout } = render(tree, {
            css: 'td { border: single; background-color: blue; empty-cells: hide; }',
            width: 20, height: 5,
        })

        // Then: the empty cell's box paints nothing
        const box = layout.get(emptyCell.id)!
        for (let row = box.y; row < box.y + box.height; row++) {
            for (let col = box.x; col < box.x + box.width; col++) {
                assert.equal(buffer.getCell(col, row)?.char ?? ' ', ' ', `(${col},${row}) should be blank`)
                assert.notEqual(buffer.getCell(col, row)?.bg, 'blue', `(${col},${row}) should not be blue`)
            }
        }
        // The non-empty cell still has its border
        assert.equal(buffer.getCell(0, 0)?.char, '┌')
    })

    it('cells with content are unaffected by empty-cells: hide', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('A')])]),
        ])

        // When
        const { buffer } = render(tree, {
            css: 'td { border: single; empty-cells: hide; }',
            width: 20, height: 5,
        })

        // Then
        assert.equal(rowText(buffer, 0), '┌─┐')
        assert.equal(rowText(buffer, 1), '│A│')
        assert.equal(rowText(buffer, 2), '└─┘')
    })
})

describe('integration: table border-spacing', () => {

    it('border-spacing sets the horizontal gap between columns', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('table', {}, [el('tr', {}, [cellA, cellB])])

        // When
        const { layout } = render(tree, {
            css: 'table { border-spacing: 4cell; }',
            width: 20, height: 5,
        })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxB.x, boxA.x + boxA.width + 4)
    })

    it('border-spacing: 0 removes the column gap', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('table', {}, [el('tr', {}, [cellA, cellB])])

        // When
        const { layout } = render(tree, {
            css: 'table { border-spacing: 0; }',
            width: 20, height: 5,
        })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxB.x, boxA.x + boxA.width)
    })

    it('two-value border-spacing sets horizontal and vertical gaps', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('table', {}, [
            el('tr', {}, [cellA]),
            el('tr', {}, [cellB]),
        ])

        // When
        const { layout } = render(tree, {
            css: 'table { border-spacing: 3cell 2cell; }',
            width: 20, height: 8 })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxB.y, boxA.y + boxA.height + 2)
    })

    it('default spacing stays 2 horizontal, 0 vertical', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const cellC = el('td', {}, [text('C')])
        const tree = el('table', {}, [
            el('tr', {}, [cellA, cellB]),
            el('tr', {}, [cellC]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 5 })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        const boxC = layout.get(cellC.id)!
        assert.equal(boxB.x, boxA.x + boxA.width + 2, 'horizontal gap should default to 2')
        assert.equal(boxC.y, boxA.y + boxA.height, 'vertical gap should default to 0')
    })
})
