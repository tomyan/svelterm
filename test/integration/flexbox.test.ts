import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText, regionText } from './harness.js'

describe('integration: flexbox layout', () => {

    it('renders children in a row', () => {
        // Given
        const tree = el('div', { class: 'row' }, [
            el('span', {}, [text('AA')]),
            el('span', {}, [text('BB')]),
            el('span', {}, [text('CC')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '.row { display: flex; flex-direction: row; }',
            width: 20, height: 3,
        })

        // Then: all on same row, side by side
        const line = rowText(buffer, 0)
        assert.ok(line.includes('AA'), `expected "AA" in "${line}"`)
        assert.ok(line.includes('BB'), `expected "BB" in "${line}"`)
        assert.ok(line.includes('CC'), `expected "CC" in "${line}"`)
    })

    it('renders children in a column', () => {
        // Given
        const tree = el('div', { class: 'col' }, [
            el('div', {}, [text('First')]),
            el('div', {}, [text('Second')]),
            el('div', {}, [text('Third')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '.col { display: flex; flex-direction: column; }',
            width: 20, height: 5,
        })

        // Then: stacked vertically
        assert.equal(rowText(buffer, 0), 'First')
        assert.equal(rowText(buffer, 1), 'Second')
        assert.equal(rowText(buffer, 2), 'Third')
    })

    it('applies gap between flex items', () => {
        // Given
        const tree = el('div', { class: 'row' }, [
            el('div', { class: 'item' }, [text('A')]),
            el('div', { class: 'item' }, [text('B')]),
        ])

        // When
        const { buffer, layout } = render(tree, {
            css: `.row { display: flex; flex-direction: row; gap: 3cell; }
                  .item { width: 2cell; }`,
            width: 20, height: 3,
        })

        // Then: items should be 2-wide with 3 gap between
        // A at x=0, B at x=5 (2 width + 3 gap)
        assert.equal(buffer.getCell(0, 0)?.char, 'A')
        assert.equal(buffer.getCell(5, 0)?.char, 'B')
    })

    it('flex-grow fills remaining space', () => {
        // Given
        const tree = el('div', { class: 'row' }, [
            el('div', { class: 'fixed' }, [text('F')]),
            el('div', { class: 'grow' }, [text('G')]),
        ])

        // When
        const { layout } = render(tree, {
            css: `.row { display: flex; flex-direction: row; width: 20cell; }
                  .fixed { width: 5cell; }
                  .grow { flex-grow: 1; }`,
            width: 20, height: 3,
        })

        // Then: grow item takes remaining 15 cells
        const growNode = tree.children[1]
        const growBox = layout.get(growNode.id)!
        assert.equal(growBox.width, 15)
    })

    it('justify-content: center centers items', () => {
        // Given
        const tree = el('div', { class: 'center' }, [
            el('div', { class: 'item' }, [text('Hi')]),
        ])

        // When
        const { layout } = render(tree, {
            css: `.center { display: flex; justify-content: center; width: 20cell; }
                  .item { width: 4cell; }`,
            width: 20, height: 3,
        })

        // Then: 4-wide item centered in 20 → x=8
        const itemBox = layout.get(tree.children[0].id)!
        assert.equal(itemBox.x, 8)
    })

    it('justify-content: space-between distributes items', () => {
        // Given
        const tree = el('div', { class: 'sb' }, [
            el('div', { class: 'item' }, [text('A')]),
            el('div', { class: 'item' }, [text('B')]),
            el('div', { class: 'item' }, [text('C')]),
        ])

        // When
        const { layout } = render(tree, {
            css: `.sb { display: flex; justify-content: space-between; width: 20cell; }
                  .item { width: 2cell; }`,
            width: 20, height: 3,
        })

        // Then: first at 0, last at 18, middle evenly spaced
        const aBox = layout.get(tree.children[0].id)!
        const cBox = layout.get(tree.children[2].id)!
        assert.equal(aBox.x, 0)
        assert.equal(cBox.x, 18) // 20 - 2 = 18
    })

    it('nested flex containers layout correctly', () => {
        // Given: outer row, inner column
        const tree = el('div', { class: 'outer' }, [
            el('div', { class: 'inner' }, [
                el('div', {}, [text('Top')]),
                el('div', {}, [text('Bot')]),
            ]),
            el('div', { class: 'side' }, [text('Side')]),
        ])

        // When
        const { buffer } = render(tree, {
            css: `.outer { display: flex; flex-direction: row; }
                  .inner { display: flex; flex-direction: column; width: 10cell; }
                  .side { width: 10cell; }`,
            width: 30, height: 5,
        })

        // Then: inner column stacked, side next to it
        assert.equal(regionText(buffer, 0, 0, 3), 'Top')
        assert.equal(regionText(buffer, 0, 1, 3), 'Bot')
        assert.equal(regionText(buffer, 10, 0, 4), 'Side')
    })

    it('flex-wrap wraps items to next line', () => {
        // Given: 3 items of 8cell in 20cell container
        const tree = el('div', { class: 'wrap' }, [
            el('div', { class: 'item' }, [text('AA')]),
            el('div', { class: 'item' }, [text('BB')]),
            el('div', { class: 'item' }, [text('CC')]),
        ])

        // When
        const { layout } = render(tree, {
            css: `.wrap { display: flex; flex-wrap: wrap; width: 20cell; }
                  .item { width: 8cell; height: 1cell; }`,
            width: 20, height: 5,
        })

        // Then: first two fit on row 0, third wraps to row 1
        const aBox = layout.get(tree.children[0].id)!
        const bBox = layout.get(tree.children[1].id)!
        const cBox = layout.get(tree.children[2].id)!
        assert.equal(aBox.y, bBox.y, 'A and B should be on same row')
        assert.equal(cBox.y, aBox.y + 1, 'C should wrap to next row')
    })
})
