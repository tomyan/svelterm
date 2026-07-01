import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './harness.js'

describe('integration: display inline-table', () => {

    it('inline-table flows on the same line as adjacent text', () => {
        // Given
        const table = el('table', { style: 'display: inline-table' }, [
            el('tr', {}, [el('td', {}, [text('X')])]),
        ])
        const tree = el('div', {}, [text('before '), table, text(' after')])

        // When
        const { buffer } = render(tree, { css: '', width: 40, height: 3 })

        // Then
        assert.equal(rowText(buffer, 0), 'before X after')
    })

    it('inline-table shrink-wraps to its content width', () => {
        // Given
        const table = el('table', { style: 'display: inline-table' }, [
            el('tr', {}, [el('td', {}, [text('AB')]), el('td', {}, [text('CD')])]),
        ])
        const tree = el('div', {}, [table])

        // When
        const { layout } = render(tree, { css: '', width: 40, height: 3 })

        // Then: 2 + 2 wide columns + default 2-cell spacing = 6, not the full 40
        const box = layout.get(table.id)!
        assert.equal(box.width, 6)
    })

    it('display: table fills the available width like a block', () => {
        // Given
        const table = el('table', {}, [
            el('tr', {}, [el('td', {}, [text('AB')])]),
        ])
        const tree = el('div', {}, [table])

        // When
        const { layout } = render(tree, { css: '', width: 40, height: 3 })

        // Then: existing block behaviour is unchanged
        const box = layout.get(table.id)!
        assert.equal(box.width, 40)
    })

    it('inline-table contents use table layout', () => {
        // Given
        const cellA = el('td', {}, [text('A')])
        const cellB = el('td', {}, [text('B')])
        const table = el('table', { style: 'display: inline-table' }, [
            el('tr', {}, [cellA]),
            el('tr', {}, [cellB]),
        ])
        const tree = el('div', {}, [table])

        // When
        const { layout } = render(tree, { css: '', width: 40, height: 5 })

        // Then: rows stack vertically in the same column
        const boxA = layout.get(cellA.id)!
        const boxB = layout.get(cellB.id)!
        assert.equal(boxA.x, boxB.x)
        assert.equal(boxB.y, boxA.y + boxA.height)
    })

    it('two inline-tables sit side by side', () => {
        // Given
        const t1 = el('table', { style: 'display: inline-table' }, [
            el('tr', {}, [el('td', {}, [text('L')])]),
        ])
        const t2 = el('table', { style: 'display: inline-table' }, [
            el('tr', {}, [el('td', {}, [text('R')])]),
        ])
        const tree = el('div', {}, [t1, t2])

        // When
        const { buffer, layout } = render(tree, { css: '', width: 40, height: 3 })

        // Then
        const box1 = layout.get(t1.id)!
        const box2 = layout.get(t2.id)!
        assert.equal(box1.y, box2.y, 'tables should share a line')
        assert.ok(box2.x >= box1.x + box1.width, 'second table starts after the first')
        assert.equal(rowText(buffer, 0), 'LR')
    })
})
