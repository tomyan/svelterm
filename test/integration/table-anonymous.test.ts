import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './harness.js'

describe('integration: anonymous tables around stray table-internals', () => {

    // WPT: css/css2/tables/table-anonymous-objects-021.html (behaviour)
    it('a stray row outside a table lays out its cells side by side', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('div', {}, [el('tr', {}, [cellA, cellB])])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 3 })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxA.y, boxB.y, 'cells share a row')
        assert.ok(boxB.x > boxA.x, 'cells sit in separate columns')
    })

    it('consecutive stray rows form one anonymous table with aligned columns', () => {
        // Given: col 0 must be sized by the widest cell across BOTH rows
        const shortCell = el('td', {}, [text('A')])
        const cellAfterShort = el('td', {}, [text('X')])
        const longCell = el('td', {}, [text('AAAA')])
        const cellAfterLong = el('td', {}, [text('Y')])
        const tree = el('div', {}, [
            el('tr', {}, [shortCell, cellAfterShort]),
            el('tr', {}, [longCell, cellAfterLong]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 5 })

        // Then
        const boxX = layout.get(cellAfterShort.id)!
        const boxY = layout.get(cellAfterLong.id)!
        assert.equal(boxX.x, boxY.x, 'second column aligns across rows')
        assert.ok(boxY.y > boxX.y, 'rows stack vertically')
    })

    it('a run of stray cells outside a table forms one anonymous row', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('div', {}, [cellA, cellB])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 3 })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxA.y, boxB.y, 'stray cells share a row')
        assert.ok(boxB.x > boxA.x, 'cells sit in separate columns')
    })

    it('a stray row-group outside a table lays out as a table', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('div', {}, [
            el('tbody', {}, [
                el('tr', {}, [cellA]),
                el('tr', {}, [cellB]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 5 })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxA.x, boxB.x, 'rows share a column')
        assert.ok(boxB.y > boxA.y, 'rows stack vertically')
    })

    it('table-internal runs separated by a block form separate tables', () => {
        // Given: a wide cell in the second run must not affect the first run's columns
        const firstRunCell = el('td', {}, [text('A')])
        const firstRunSecond = el('td', {}, [text('X')])
        const secondRunCell = el('td', {}, [text('AAAA')])
        const tree = el('div', {}, [
            el('tr', {}, [firstRunCell, firstRunSecond]),
            el('div', {}, [text('separator')]),
            el('tr', {}, [secondRunCell, el('td', {}, [text('Y')])]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 6 })

        // Then: first table's col 0 is sized by 'A' alone, so X sits right after it
        const boxX = layout.get(firstRunSecond.id)!
        const boxA = layout.get(firstRunCell.id)!
        assert.equal(boxX.x, boxA.x + 1, 'first run col 0 is 1 wide, unaffected by the second run')
    })
})

describe('integration: anonymous boxes inside a table', () => {

    // WPT: css/css2/tables/table-anonymous-objects-015.html (behaviour)
    it('stray cells directly inside a table form an anonymous row', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('table', {}, [cellA, cellB])

        // When
        const { buffer, layout } = render(tree, { css: '', width: 20, height: 3 })

        // Then: side by side, like cells of one row
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxA.y, boxB.y, 'stray cells share a row')
        assert.ok(boxB.x > boxA.x, 'cells sit in separate columns')
        assert.equal(rowText(buffer, 0), 'A  B')
    })

    it('a row after stray cells starts a new row', () => {
        // Given: <td>A</td><tr><td>B</td></tr> — the stray cell's anonymous
        // row ends where the explicit row begins
        const strayCell = el('td', {}, [text('A')])
        const rowCell = el('td', {}, [text('B')])
        const tree = el('table', {}, [strayCell, el('tr', {}, [rowCell])])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 5 })

        // Then
        const boxA = layout.get(strayCell.id)!
        const boxB = layout.get(rowCell.id)!
        assert.ok(boxB.y > boxA.y, 'explicit row is below the anonymous row')
    })

    // WPT: css/css2/tables/table-anonymous-objects-001.html (behaviour)
    it('text directly inside a row becomes an anonymous cell', () => {
        // Given
        const stray = text('S')
        const cell = el('td', {}, [text('C')])
        const tree = el('table', {}, [el('tr', {}, [stray, cell])])

        // When
        const { buffer, layout } = render(tree, { css: '', width: 20, height: 3 })

        // Then: the text occupies its own column before the real cell
        const boxS = layout.get(stray.id)!
        const boxC = layout.get(cell.id)!
        assert.equal(boxS.y, boxC.y, 'anonymous cell shares the row')
        assert.ok(boxC.x > boxS.x, 'real cell sits in the next column')
        assert.equal(rowText(buffer, 0), 'S  C')
    })

    it('stray cells inside a row-group form an anonymous row', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const tree = el('table', {}, [el('tbody', {}, [cellA, cellB])])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 3 })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxA.y, boxB.y, 'stray cells share a row')
        assert.ok(boxB.x > boxA.x, 'cells sit in separate columns')
    })

    it('mixed stray cells and rows inside a row-group keep source order', () => {
        // Given
        const stray = el('td', {}, [text('A')])
        const rowCell = el('td', {}, [text('B')])
        const tree = el('table', {}, [
            el('tbody', {}, [stray, el('tr', {}, [rowCell])]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 20, height: 5 })

        // Then
        const boxA = layout.get(stray.id)!
        const boxB = layout.get(rowCell.id)!
        assert.ok(boxB.y > boxA.y, 'explicit row is below the anonymous row')
    })
})
