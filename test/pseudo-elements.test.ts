import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

const WIDTH = 40
const HEIGHT = 6

function renderItem(css: string, attrs?: Record<string, string>, text = 'item') {
    const root = new TermNode('element', 'root')
    const host = new TermNode('element', 'div')
    host.attributes.set('class', 'x')
    if (attrs) for (const [k, v] of Object.entries(attrs)) host.attributes.set(k, v)
    host.insertBefore(new TermNode('text', text), null)
    root.insertBefore(host, null)

    const stylesheet = parseCSS(css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return { buffer, host, styles }
}

function rowText(buffer: CellBuffer, row: number): string {
    let out = ''
    for (let col = 0; col < WIDTH; col++) {
        out += buffer.getCell(col, row)?.char ?? ' '
    }
    return out.trimEnd()
}

describe('::before and ::after pseudo-elements', () => {

    it('renders ::before content ahead of the element text', () => {
        const { buffer } = renderItem('.x::before { content: "> "; }')
        assert.equal(rowText(buffer, 0), '> item')
    })

    it('renders ::after content following the element text', () => {
        const { buffer } = renderItem('.x::after { content: "!"; }')
        assert.equal(rowText(buffer, 0), 'item!')
    })

    it('renders both pseudo-elements around the text', () => {
        const { buffer } = renderItem('.x::before { content: "["; } .x::after { content: "]"; }')
        assert.equal(rowText(buffer, 0), '[item]')
    })

    it('supports legacy single-colon syntax', () => {
        const { buffer } = renderItem('.x:before { content: "> "; }')
        assert.equal(rowText(buffer, 0), '> item')
    })

    it('resolves attr() against the host element', () => {
        const { buffer } = renderItem('.x::after { content: attr(data-badge); }', { 'data-badge': '(3)' })
        assert.equal(rowText(buffer, 0), 'item(3)')
    })

    it('concatenates strings and attr() operands', () => {
        const { buffer } = renderItem('.x::after { content: " [" attr(data-n) "]"; }', { 'data-n': '7' })
        assert.equal(rowText(buffer, 0), 'item [7]')
    })

    it('renders nothing for content: none or an empty string', () => {
        const { buffer } = renderItem('.x::before { content: none; } .x::after { content: ""; }')
        assert.equal(rowText(buffer, 0), 'item')
    })

    it('renders nothing when a ::before rule has no content declaration', () => {
        const { buffer } = renderItem('.x::before { color: red; }')
        assert.equal(rowText(buffer, 0), 'item')
    })

    it('styles the pseudo-element without restyling the host', () => {
        const { buffer } = renderItem('.x::before { content: "!"; color: red; }')
        assert.equal(rowText(buffer, 0), '!item')
        assert.equal(buffer.getCell(0, 0)?.fg, 'red')
        assert.notEqual(buffer.getCell(1, 0)?.fg, 'red')
    })

    it('drops the pseudo box when its rule stops matching on re-resolve', () => {
        // Given
        const root = new TermNode('element', 'root')
        const host = new TermNode('element', 'div')
        host.attributes.set('class', 'x')
        host.insertBefore(new TermNode('text', 'item'), null)
        root.insertBefore(host, null)
        const stylesheet = parseCSS('.x::before { content: "> "; }')
        resolveStyles(root, stylesheet)
        assert.ok(host.pseudoBefore)

        // When
        host.attributes.set('class', 'y')
        const styles = resolveStyles(root, stylesheet)

        // Then
        assert.equal(host.pseudoBefore, null)
        const layout = computeLayout(root, styles, WIDTH, HEIGHT)
        const buffer = new CellBuffer(WIDTH, HEIGHT)
        paint(root, buffer, styles, layout)
        assert.equal(rowText(buffer, 0), 'item')
    })

    it('inherits the host colour when the pseudo sets none', () => {
        const { buffer } = renderItem('.x { color: green; } .x::before { content: "> "; }')
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
        assert.equal(buffer.getCell(2, 0)?.fg, 'green')
    })
})
