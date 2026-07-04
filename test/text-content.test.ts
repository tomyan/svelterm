import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { wrapText } from '../src/layout/text.js'
import { CellBuffer } from '../src/render/buffer.js'
import { paintNodes } from '../src/render/incremental-paint.js'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle, resolveStyles } from '../src/css/compute.js'
import { parseCSS } from '../src/css/parser.js'
import type { ResolvedStyle } from '../src/css/compute.js'
import type { LayoutBox } from '../src/layout/engine.js'

function paintedRow(buffer: CellBuffer, row: number, width: number): string {
    let out = ''
    for (let col = 0; col < width; col++) out += buffer.getCell(col, row)?.char ?? ' '
    return out.replace(/\s+$/, '')
}

function textInParent(text: string, parentStyle: Partial<ResolvedStyle>, width = 12) {
    const root = new TermNode('element', 'root')
    const parent = new TermNode('element', 'div')
    const textNode = new TermNode('text', text)
    parent.insertBefore(textNode, null)
    root.insertBefore(parent, null)
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, defaultStyle('div'))
    styles.set(parent.id, { ...defaultStyle('div'), ...parentStyle, width })
    const layout = new Map<number, LayoutBox>()
    layout.set(root.id, { x: 0, y: 0, width, height: 4 })
    layout.set(parent.id, { x: 0, y: 0, width, height: 1 })
    layout.set(textNode.id, { x: 0, y: 0, width, height: 1 })
    const buffer = new CellBuffer(width, 4)
    paintNodes(new Set([textNode]), buffer, styles, layout, root)
    return buffer
}

describe('word-break', () => {

    it('break-all wraps at any character, not just spaces', () => {
        // When
        const lines = wrapText('abcdef ghij', 4, 'break-all')

        // Then
        assert.deepEqual(lines, ['abcd', 'ef g', 'hij'])
    })

    it('normal keeps breaking at spaces with hard breaks only for long words', () => {
        assert.deepEqual(wrapText('abcdef ghij', 4), ['abcd', 'ef', 'ghij'])
    })

    it('word-break resolves from CSS', () => {
        // Given
        const root = new TermNode('element', 'div')
        const styles = resolveStyles(root, parseCSS('div { word-break: break-all; }'))

        // Then
        assert.equal(styles.get(root.id)?.wordBreak, 'break-all')
    })
})

describe('text-overflow: ellipsis-middle', () => {

    it('truncates in the middle keeping both ends', () => {
        // When
        const buffer = textInParent('/Users/tom/projects/svelterm/src/index.ts', {
            whiteSpace: 'nowrap', textOverflow: 'ellipsis-middle',
        })

        // Then
        const row = paintedRow(buffer, 0, 12)
        assert.equal(row.length, 12)
        assert.ok(row.includes('…'), row)
        assert.ok(row.startsWith('/User'), row)
        assert.ok(row.endsWith('.ts'), row)
    })
})

describe('ANSI passthrough (svt-ansi)', () => {

    it('paints SGR-coloured text as styled cells', () => {
        // Given: red "err" then plain " ok"
        const root = new TermNode('element', 'root')
        const pre = new TermNode('element', 'svt-ansi')
        const textNode = new TermNode('text', '\x1b[31merr\x1b[0m ok')
        pre.insertBefore(textNode, null)
        root.insertBefore(pre, null)
        const styles = new Map<number, ResolvedStyle>()
        styles.set(root.id, defaultStyle('div'))
        styles.set(pre.id, defaultStyle('svt-ansi'))
        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 10, height: 2 })
        layout.set(pre.id, { x: 0, y: 0, width: 10, height: 1 })
        layout.set(textNode.id, { x: 0, y: 0, width: 10, height: 1 })
        const buffer = new CellBuffer(10, 2)

        // When
        paintNodes(new Set([pre]), buffer, styles, layout, root)

        // Then
        assert.equal(buffer.getCell(0, 0)?.char, 'e')
        assert.equal(buffer.getCell(0, 0)?.fg, 'red')
        assert.equal(buffer.getCell(4, 0)?.char, 'o')
        assert.equal(buffer.getCell(4, 0)?.fg, 'default')
    })
})
