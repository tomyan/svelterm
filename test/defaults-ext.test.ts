import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'

function render(buildTree: (root: TermNode) => void, width = 40, height = 15) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(DEFAULT_STYLESHEET)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, styles }
}

function findChar(buffer: CellBuffer, char: string, w = 40, h = 15): { col: number; row: number } | null {
    for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
            if (buffer.getCell(col, row)?.char === char) return { col, row }
        }
    }
    return null
}

describe('extended default styles', () => {

    it('mark has highlight background', () => {
        const { buffer } = render((root) => {
            const mark = new TermNode('element', 'mark')
            const text = new TermNode('text', 'highlight')
            mark.insertBefore(text, null)
            root.insertBefore(mark, null)
        })
        const pos = findChar(buffer, 'h')!
        assert.ok(pos)
        assert.ok(buffer.getCell(pos.col, pos.row)?.bg !== 'default', 'mark should have background')
    })

    it('kbd has border', () => {
        const { styles } = render((root) => {
            const kbd = new TermNode('element', 'kbd')
            const text = new TermNode('text', 'Enter')
            kbd.insertBefore(text, null)
            root.insertBefore(kbd, null)
        })
        const kbdStyle = [...styles.values()].find(s => s.borderStyle !== 'none')
        assert.ok(kbdStyle, 'kbd should have a border')
    })

    it('abbr has underline', () => {
        const { buffer } = render((root) => {
            const abbr = new TermNode('element', 'abbr')
            const text = new TermNode('text', 'HTML')
            abbr.insertBefore(text, null)
            root.insertBefore(abbr, null)
        })
        const pos = findChar(buffer, 'H')!
        assert.ok(pos)
        assert.equal(buffer.getCell(pos.col, pos.row)?.underline, true)
    })

    it('blockquote has left indent', () => {
        const { buffer } = render((root) => {
            const bq = new TermNode('element', 'blockquote')
            const text = new TermNode('text', 'Quote')
            bq.insertBefore(text, null)
            root.insertBefore(bq, null)
        })
        const pos = findChar(buffer, 'Q')!
        assert.ok(pos)
        assert.ok(pos.col > 0, 'blockquote should be indented')
    })
})
