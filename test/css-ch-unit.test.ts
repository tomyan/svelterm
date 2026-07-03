import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCellValue, parseSizeValue } from '../src/css/values.js'
import { evaluateCalc } from '../src/css/calc.js'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

describe('ch unit as an alias of cell', () => {

    describe('in plain values', () => {
        it('parses a ch length like a cell length', () => {
            assert.equal(parseCellValue('4ch'), 4)
            assert.equal(parseCellValue('4cell'), 4)
        })

        it('rounds fractional ch to whole cells', () => {
            assert.equal(parseCellValue('4.6ch'), 5)
        })

        it('passes ch through size parsing', () => {
            assert.equal(parseSizeValue('12ch'), 12)
        })

        it('does not mistake keywords ending in ch for lengths', () => {
            assert.equal(parseCellValue('stretch'), 0)
        })
    })

    describe('in calc()', () => {
        it('resolves ch operands', () => {
            assert.equal(evaluateCalc('calc(10ch + 2cell)', 40), 12)
        })
    })

    describe('in grid templates', () => {
        it('sizes grid columns declared in ch', () => {
            // Given
            const root = new TermNode('element', 'root')
            const stylesheet = parseCSS('.grid{display:grid;grid-template-columns:10ch 10ch}')
            const grid = new TermNode('element', 'div')
            grid.attributes.set('class', 'grid')
            for (const label of ['A', 'B']) {
                const child = new TermNode('element', 'div')
                child.insertBefore(new TermNode('text', label), null)
                grid.insertBefore(child, null)
            }
            root.insertBefore(grid, null)

            // When
            const styles = resolveStyles(root, stylesheet)
            const layout = computeLayout(root, styles, 40, 10)
            const buffer = new CellBuffer(40, 10)
            paint(root, buffer, styles, layout)

            // Then
            const positions: Record<string, number> = {}
            for (let col = 0; col < 40; col++) {
                const char = buffer.getCell(col, 0)?.char
                if (char === 'A' || char === 'B') positions[char] = col
            }
            assert.equal(positions['A'], 0)
            assert.equal(positions['B'], 10)
        })
    })
})
