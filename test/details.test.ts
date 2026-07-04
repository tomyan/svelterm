import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { toggleDetails } from '../src/input/details.js'

const WIDTH = 40
const HEIGHT = 8

function makeDetails(open: boolean) {
    const root = new TermNode('element', 'root')
    const details = new TermNode('element', 'details')
    if (open) details.attributes.set('open', 'true')
    const summary = new TermNode('element', 'summary')
    summary.insertBefore(new TermNode('text', 'More info'), null)
    const body = new TermNode('element', 'p')
    body.insertBefore(new TermNode('text', 'Hidden content'), null)
    details.insertBefore(summary, null)
    details.insertBefore(body, null)
    root.insertBefore(details, null)
    return { root, details, summary, body }
}

function render(root: TermNode, css = '') {
    const stylesheet = parseCSS(DEFAULT_STYLESHEET + css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return { buffer, styles, layout }
}

function bufferText(buffer: CellBuffer): string {
    let out = ''
    for (let row = 0; row < HEIGHT; row++) {
        for (let col = 0; col < WIDTH; col++) out += buffer.getCell(col, row)?.char ?? ' '
    }
    return out
}

describe('<details> and <summary>', () => {

    it('hides body content while closed', () => {
        const { root } = makeDetails(false)
        const { buffer } = render(root)
        const text = bufferText(buffer)
        assert.ok(text.includes('More info'))
        assert.ok(!text.includes('Hidden content'))
    })

    it('shows body content when open', () => {
        const { root } = makeDetails(true)
        const { buffer } = render(root)
        const text = bufferText(buffer)
        assert.ok(text.includes('More info'))
        assert.ok(text.includes('Hidden content'))
    })

    it('marks the summary with a disclosure triangle', () => {
        const closed = render(makeDetails(false).root)
        assert.equal(closed.buffer.getCell(0, 0)?.char, '▶')
        const open = render(makeDetails(true).root)
        assert.equal(open.buffer.getCell(0, 0)?.char, '▼')
    })

    it('supports [open] attribute styling', () => {
        const { root } = makeDetails(true)
        const { buffer } = render(root, 'details[open] summary { color: green; }')
        // The summary text starts after the 2-cell marker padding
        assert.equal(buffer.getCell(2, 0)?.fg, 'green')
    })

    describe('toggleDetails', () => {
        it('opens a closed details from its summary and closes it again', () => {
            // Given
            const { details, summary } = makeDetails(false)

            // When / Then
            toggleDetails(summary)
            assert.equal(details.attributes.get('open'), 'true')
            toggleDetails(summary)
            assert.equal(details.attributes.has('open'), false)
        })

        it('dispatches a toggle event on the details element', () => {
            // Given
            const { details, summary } = makeDetails(false)
            const seen: boolean[] = []
            details.listeners.set('toggle', new Set([(e: any) => seen.push(e.data.open)]))

            // When
            toggleDetails(summary)
            toggleDetails(summary)

            // Then
            assert.deepEqual(seen, [true, false])
        })

        it('does nothing for a summary outside details', () => {
            // Given
            const lone = new TermNode('element', 'summary')

            // When / Then (no throw)
            toggleDetails(lone)
        })
    })
})
