import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text } from './harness.js'

/** Generic elements with table display values lay out like their HTML
 * counterparts (DESIGN-tables.md acceptance 3). */
describe('integration: table display values on non-table elements', () => {

    const CSS = `
        .t { display: table; }
        .r { display: table-row; }
        .c { display: table-cell; }
    `

    it('divs with table displays lay out cells side by side', () => {
        // Given
        const cellA = el('div', { class: 'c' }, [text('A')])
        const cellB = el('div', { class: 'c' }, [text('B')])
        const tree = el('div', { class: 't' }, [
            el('div', { class: 'r' }, [cellA, cellB]),
        ])

        // When
        const { layout } = render(tree, { css: CSS, width: 20, height: 3 })

        // Then
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxA.y, boxB.y, 'cells share a row')
        assert.ok(boxB.x > boxA.x, 'cells sit in separate columns')
    })

    it('divs with table displays share column widths across rows', () => {
        // Given
        const afterShort = el('div', { class: 'c' }, [text('X')])
        const afterLong = el('div', { class: 'c' }, [text('Y')])
        const tree = el('div', { class: 't' }, [
            el('div', { class: 'r' }, [el('div', { class: 'c' }, [text('A')]), afterShort]),
            el('div', { class: 'r' }, [el('div', { class: 'c' }, [text('AAAA')]), afterLong]),
        ])

        // When
        const { layout } = render(tree, { css: CSS, width: 20, height: 5 })

        // Then
        assert.equal(layout.get(afterShort.id)!.x, layout.get(afterLong.id)!.x,
            'second column aligns across rows')
    })

    it('a div table matches a real table laid out with the same spacing', () => {
        // Given: identical structure as <div> table and as <table>, with the
        // same border-spacing (the UA 2cell default only targets <table>)
        const divCell = el('div', { class: 'c' }, [text('B')])
        const divTable = el('div', { class: 't', style: 'border-spacing: 2cell' }, [
            el('div', { class: 'r' }, [el('div', { class: 'c' }, [text('AA')]), divCell]),
        ])
        const realCell = el('td', {}, [text('B')])
        const realTable = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('AA')]), realCell]),
        ])
        const tree = el('div', {}, [divTable, realTable])

        // When
        const { layout } = render(tree, { css: CSS, width: 20, height: 6 })

        // Then: same column position for the second cell
        assert.equal(layout.get(divCell.id)!.x, layout.get(realCell.id)!.x)
    })

    it('display: table-caption on a div renders above the rows', () => {
        // Given
        const caption = el('div', { style: 'display: table-caption' }, [text('Title')])
        const cell = el('div', { class: 'c' }, [text('A')])
        const tree = el('div', { class: 't' }, [
            el('div', { class: 'r' }, [cell]),
            caption,
        ])

        // When
        const { layout } = render(tree, { css: CSS, width: 20, height: 5 })

        // Then
        const capBox = layout.get(caption.id)!
        const cellBox = layout.get(cell.id)!
        assert.ok(capBox.y < cellBox.y, 'caption sits above the rows')
    })

    it('colspan and rowspan attributes work on div cells', () => {
        // Given
        const spanCell = el('div', { class: 'c', rowspan: '2' }, [text('S')])
        const cellX = el('div', { class: 'c' }, [text('X')])
        const cellY = el('div', { class: 'c' }, [text('Y')])
        const tree = el('div', { class: 't' }, [
            el('div', { class: 'r' }, [spanCell, cellX]),
            el('div', { class: 'r' }, [cellY]),
        ])

        // When
        const { layout } = render(tree, { css: CSS, width: 20, height: 5 })

        // Then: Y lands in column 1, below X, because S spans both rows
        const boxX = layout.get(cellX.id)!
        const boxY = layout.get(cellY.id)!
        assert.equal(boxY.x, boxX.x, 'second-row cell skips the rowspanned column')
        assert.ok(boxY.y > boxX.y)
    })
})
