import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import type { MediaContext } from '../src/css/media.js'

function render(
    buildTree: (root: TermNode) => void,
    colorScheme: 'dark' | 'light',
    width = 40, height = 5,
) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(DEFAULT_STYLESHEET)
    buildTree(root)
    const media: MediaContext = { colorScheme, displayMode: 'terminal', width, height }
    const styles = resolveStyles(root, stylesheet, media)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe('dark/light mode default styles', () => {

    it('code element has appropriate color in dark mode', () => {
        const buffer = render((root) => {
            const code = new TermNode('element', 'code')
            const text = new TermNode('text', 'x = 1')
            code.insertBefore(text, null)
            root.insertBefore(code, null)
        }, 'dark')
        const fg = buffer.getCell(0, 0)?.fg
        assert.ok(fg !== 'default', `code should have non-default color in dark mode, got ${fg}`)
    })

    it('code element has appropriate color in light mode', () => {
        const buffer = render((root) => {
            const code = new TermNode('element', 'code')
            const text = new TermNode('text', 'x = 1')
            code.insertBefore(text, null)
            root.insertBefore(code, null)
        }, 'light')
        const fg = buffer.getCell(0, 0)?.fg
        assert.ok(fg !== 'default', `code should have non-default color in light mode, got ${fg}`)
    })

    it('link color differs between dark and light mode', () => {
        const darkBuf = render((root) => {
            const a = new TermNode('element', 'a')
            const text = new TermNode('text', 'Link')
            a.insertBefore(text, null)
            root.insertBefore(a, null)
        }, 'dark')

        const lightBuf = render((root) => {
            const a = new TermNode('element', 'a')
            const text = new TermNode('text', 'Link')
            a.insertBefore(text, null)
            root.insertBefore(a, null)
        }, 'light')

        const darkFg = darkBuf.getCell(0, 0)?.fg
        const lightFg = lightBuf.getCell(0, 0)?.fg
        // Both should have a color, but they should differ
        assert.ok(darkFg !== 'default')
        assert.ok(lightFg !== 'default')
        assert.notEqual(darkFg, lightFg, 'link color should differ between dark and light')
    })
})
