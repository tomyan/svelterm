import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './harness.js'

describe('integration: table layout', () => {

    it('basic table positions cells in rows and columns', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [
                el('td', {}, [text('A1')]),
                el('td', {}, [text('B1')]),
            ]),
            el('tr', {}, [
                el('td', {}, [text('A2')]),
                el('td', {}, [text('B2')]),
            ]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '',
            width: 30, height: 5,
        })

        // Then: cells rendered in grid pattern
        const row0 = rowText(buffer, 0)
        assert.ok(row0.includes('A1'), `row 0 should contain A1: "${row0}"`)
        assert.ok(row0.includes('B1'), `row 0 should contain B1: "${row0}"`)

        const row1 = rowText(buffer, 1)
        assert.ok(row1.includes('A2'), `row 1 should contain A2: "${row1}"`)
    })

    it('column width is determined by widest cell', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [
                el('td', {}, [text('Short')]),
                el('td', {}, [text('X')]),
            ]),
            el('tr', {}, [
                el('td', {}, [text('Longer Text')]),
                el('td', {}, [text('Y')]),
            ]),
        ])

        // When
        const { layout } = render(tree, {
            css: '',
            width: 40, height: 5,
        })

        // Then: first column should be at least as wide as "Longer Text" (11 chars)
        const firstRow = tree.children[0]
        const firstCell = firstRow.children[0]
        const firstCellBox = layout.get(firstCell.id)!
        assert.ok(firstCellBox.width >= 11, `first column width should be >= 11 but was ${firstCellBox.width}`)
    })
})
