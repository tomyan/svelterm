import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

const WIDTH = 40
const HEIGHT = 6

function renderBar(tag: string, attrs: Record<string, string>, css = '', withText?: string) {
    const root = new TermNode('element', 'root')
    const bar = new TermNode('element', tag)
    for (const [k, v] of Object.entries(attrs)) bar.attributes.set(k, v)
    if (withText) bar.insertBefore(new TermNode('text', withText), null)
    root.insertBefore(bar, null)

    const stylesheet = parseCSS(DEFAULT_STYLESHEET + css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return { buffer, layout, bar }
}

function rowChars(buffer: CellBuffer, row: number, count: number): string {
    let out = ''
    for (let col = 0; col < count; col++) out += buffer.getCell(col, row)?.char ?? ' '
    return out
}

describe('<progress> and <meter>', () => {

    it('fills the bar proportionally to value/max', () => {
        const { buffer } = renderBar('progress', { value: '30', max: '100' })
        // Default UA width 20 cells: 30% = 6 full blocks, rest track
        assert.equal(rowChars(buffer, 0, 8), '██████░░')
    })

    it('has an intrinsic size of 20x1 cells', () => {
        const { layout, bar } = renderBar('progress', { value: '1', max: '2' })
        assert.equal(layout.get(bar.id)?.width, 20)
        assert.equal(layout.get(bar.id)?.height, 1)
    })

    it('renders only the track when no value is set (indeterminate)', () => {
        const { buffer } = renderBar('progress', {})
        assert.equal(rowChars(buffer, 0, 3), '░░░')
    })

    it('renders partial cells with eighth blocks', () => {
        const { buffer } = renderBar('progress', { value: '25', max: '100' }, 'progress { width: 10cell; }')
        // 25% of 10 = 2.5 cells: 2 full blocks + a half block
        assert.equal(rowChars(buffer, 0, 4), '██▌░')
    })

    it('meter uses min/max bounds', () => {
        const { buffer } = renderBar('meter', { value: '7', min: '2', max: '12' }, 'meter { width: 10cell; }')
        // (7-2)/(12-2) = 50% of 10 cells
        assert.equal(rowChars(buffer, 0, 6), '█████░')
    })

    it('is stylable via color', () => {
        const { buffer } = renderBar('progress', { value: '50', max: '100' }, 'progress { color: green; }')
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })

    it('does not paint fallback content', () => {
        const { buffer } = renderBar('progress', { value: '0', max: '100' }, '', 'fallback')
        assert.equal(rowChars(buffer, 0, 3), '░░░')
    })
})
