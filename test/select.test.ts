import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { cycleSelect } from '../src/input/select.js'

const WIDTH = 30
const HEIGHT = 4

function makeSelect(labels: string[], selected?: number) {
    const root = new TermNode('element', 'root')
    const select = new TermNode('element', 'select')
    const options = labels.map((label, i) => {
        const option = new TermNode('element', 'option')
        option.attributes.set('value', label.toLowerCase())
        if (i === selected) option.attributes.set('selected', 'true')
        option.insertBefore(new TermNode('text', label), null)
        select.insertBefore(option, null)
        return option
    })
    root.insertBefore(select, null)
    return { root, select, options }
}

function render(root: TermNode, css = '') {
    const stylesheet = parseCSS(DEFAULT_STYLESHEET + css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return { buffer, layout }
}

function rowChars(buffer: CellBuffer, count: number): string {
    let out = ''
    for (let col = 0; col < count; col++) out += buffer.getCell(col, 0)?.char ?? ' '
    return out
}

describe('<select> as a cycling control', () => {

    it('renders the first option with a cycle indicator by default', () => {
        const { root } = makeSelect(['Apple', 'Banana'])
        const { buffer } = render(root)
        assert.equal(rowChars(buffer, 7), 'Apple ▾')
    })

    it('renders the selected option', () => {
        const { root } = makeSelect(['Apple', 'Banana'], 1)
        const { buffer } = render(root)
        assert.equal(rowChars(buffer, 8), 'Banana ▾')
    })

    it('sizes itself to the longest option label', () => {
        const { root, select } = makeSelect(['Ab', 'Watermelon'])
        const { layout } = render(root)
        // "Watermelon" (10) + " ▾" (2)
        assert.equal(layout.get(select.id)?.width, 12)
    })

    describe('cycleSelect', () => {
        it('moves the selection forward', () => {
            // Given
            const { select, options } = makeSelect(['Apple', 'Banana', 'Cherry'])

            // When
            cycleSelect(select, 1)

            // Then
            assert.equal(options[1].attributes.get('selected'), 'true')
            assert.equal(options[0].attributes.has('selected'), false)
        })

        it('wraps forward past the last option', () => {
            // Given
            const { select, options } = makeSelect(['Apple', 'Banana'], 1)

            // When
            cycleSelect(select, 1)

            // Then
            assert.equal(options[0].attributes.get('selected'), 'true')
        })

        it('wraps backward from the first option', () => {
            // Given
            const { select, options } = makeSelect(['Apple', 'Banana'])

            // When
            cycleSelect(select, -1)

            // Then
            assert.equal(options[1].attributes.get('selected'), 'true')
        })

        it('dispatches change with the new value', () => {
            // Given
            const { select } = makeSelect(['Apple', 'Banana'])
            const seen: string[] = []
            select.listeners.set('change', new Set([(e: any) => seen.push(e.data.value)]))

            // When
            cycleSelect(select, 1)

            // Then
            assert.deepEqual(seen, ['banana'])
        })

        it('does nothing for a select without options', () => {
            const empty = new TermNode('element', 'select')
            cycleSelect(empty, 1) // no throw
        })
    })
})
