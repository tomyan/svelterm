import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

const WIDTH = 20
const HEIGHT = 4

function renderInput(type: string, attrs: Record<string, string>, css = '') {
    const root = new TermNode('element', 'root')
    const input = new TermNode('element', 'input')
    input.attributes.set('type', type)
    for (const [k, v] of Object.entries(attrs)) input.attributes.set(k, v)
    root.insertBefore(input, null)

    const stylesheet = parseCSS(DEFAULT_STYLESHEET + css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return { buffer, layout, input }
}

function rowChars(buffer: CellBuffer, count: number): string {
    let out = ''
    for (let col = 0; col < count; col++) out += buffer.getCell(col, 0)?.char ?? ' '
    return out
}

describe('checkbox and radio painting', () => {

    it('renders an unchecked checkbox as [ ]', () => {
        const { buffer } = renderInput('checkbox', {})
        assert.equal(rowChars(buffer, 3), '[ ]')
    })

    it('renders a checked checkbox as [x]', () => {
        const { buffer } = renderInput('checkbox', { checked: 'true' })
        assert.equal(rowChars(buffer, 3), '[x]')
    })

    it('renders an unchecked radio as ( )', () => {
        const { buffer } = renderInput('radio', {})
        assert.equal(rowChars(buffer, 3), '( )')
    })

    it('renders a checked radio as (•)', () => {
        const { buffer } = renderInput('radio', { checked: 'true' })
        assert.equal(rowChars(buffer, 3), '(•)')
    })

    it('has an intrinsic size of 3x1 cells', () => {
        const { layout, input } = renderInput('checkbox', {})
        assert.equal(layout.get(input.id)?.width, 3)
        assert.equal(layout.get(input.id)?.height, 1)
    })

    it('styles via :checked', () => {
        const { buffer } = renderInput('checkbox', { checked: 'true' }, 'input:checked { color: green; }')
        assert.equal(buffer.getCell(1, 0)?.fg, 'green')
    })
})
