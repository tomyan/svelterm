import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { AnsiScreen } from './helpers/ansi-screen.js'
import { CellBuffer } from '../src/render/buffer.js'
import { diffBuffers } from '../src/render/diff.js'
import { InlineScreen } from '../src/render/inline.js'
import { setColorDepth } from '../src/render/ansi.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

const WIDTH = 40
const HEIGHT = 8

function el(tag: string, attrs?: Record<string, string>, ...children: TermNode[]): TermNode {
    const node = new TermNode('element', tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.attributes.set(k, v)
    for (const child of children) node.insertBefore(child, null)
    return node
}

function text(value: string): TermNode {
    return new TermNode('text', value)
}

function renderBuffer(root: TermNode, css: string): CellBuffer {
    const stylesheet = parseCSS(DEFAULT_STYLESHEET + css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return buffer
}

function cellWithChar(screen: AnsiScreen, row: number, char: string) {
    for (let col = 0; col < screen.cols; col++) {
        if (screen.cell(col, row).char === char) return screen.cell(col, row)
    }
    throw new Error(`no '${char}' on row ${row}`)
}

function bufferText(buffer: CellBuffer): string {
    const lines: string[] = []
    for (let row = 0; row < buffer.height; row++) {
        let line = ''
        for (let col = 0; col < buffer.width; col++) line += buffer.getCell(col, row)?.char ?? ' '
        lines.push(line.replace(/\s+$/, ''))
    }
    return lines.join('\n').replace(/\n+$/, '')
}

const APP = () => el('root', {},
    el('div', { class: 'card' },
        text('Status: 好'),
        el('span', { class: 'hot' }, text('LIVE')),
    ))

const CSS = `
.card { border: single; border-color: cyan; padding: 0 1cell; width: 20cell; }
.hot { color: #ff8700; background: #123456; }
`

after(() => setColorDepth('truecolor'))

describe('emitted ANSI reproduces the frame on a terminal grid', () => {

    it('full frame round-trips at truecolor', () => {
        // Given
        setColorDepth('truecolor')
        const buffer = renderBuffer(APP(), CSS)

        // When
        const screen = new AnsiScreen(WIDTH, HEIGHT)
        screen.write(diffBuffers(null, buffer))

        // Then: glyphs and colours land where the buffer says
        assert.equal(screen.text(), bufferText(buffer))
        const live = cellWithChar(screen, 1, 'L')
        assert.equal(live.fg, '#ff8700')
        assert.equal(live.bg, '#123456')
    })

    it('incremental diffs converge on the same grid', () => {
        // Given
        setColorDepth('truecolor')
        const first = renderBuffer(APP(), CSS)
        const rootB = el('root', {},
            el('div', { class: 'card' },
                text('Status: 更新'),
                el('span', { class: 'hot' }, text('DONE')),
            ))
        const second = renderBuffer(rootB, CSS)

        // When: frame 1, then only the diff to frame 2
        const screen = new AnsiScreen(WIDTH, HEIGHT)
        screen.write(diffBuffers(null, first))
        screen.write(diffBuffers(first, second))

        // Then
        assert.equal(screen.text(), bufferText(second))
    })

    it('256-colour terminals get palette indices that decode to the same hue', () => {
        // Given
        setColorDepth('256')
        const buffer = renderBuffer(APP(), CSS)

        // When
        const screen = new AnsiScreen(WIDTH, HEIGHT)
        screen.write(diffBuffers(null, buffer))

        // Then: #ff8700 is xterm palette 208
        assert.equal(cellWithChar(screen, 1, 'L').fg, 'palette:208')
        assert.equal(screen.text(), bufferText(buffer))
    })

    it('16-colour terminals get named SGR colours only', () => {
        setColorDepth('16')
        const buffer = renderBuffer(APP(), CSS)
        const screen = new AnsiScreen(WIDTH, HEIGHT)
        const out = diffBuffers(null, buffer)
        assert.ok(!out.includes('[38;2;') && !out.includes('[38;5;'), 'extended SGR leaked')
        screen.write(out)
        assert.equal(screen.text(), bufferText(buffer))
    })

    it('mono terminals get no colour but identical glyphs', () => {
        setColorDepth('mono')
        const buffer = renderBuffer(APP(), CSS)
        const out = diffBuffers(null, buffer)
        assert.ok(!/\x1b\[3[0-8]/.test(out), 'colour SGR leaked under mono')
        const screen = new AnsiScreen(WIDTH, HEIGHT)
        screen.write(out)
        assert.equal(screen.text(), bufferText(buffer))
    })
})

describe('inline emission reproduces the live zone', () => {

    it('grow, update, and shrink converge on a virtual terminal', () => {
        // Given: a screen where the zone starts at row 2 (shell history above)
        setColorDepth('truecolor')
        const screen = new AnsiScreen(20, 10)
        screen.write('\x1b[3;1H') // cursor where the shell left it
        const inline = new InlineScreen()

        const frame = (rows: string[]) => {
            const buffer = new CellBuffer(20, rows.length)
            rows.forEach((row, y) => {
                for (let x = 0; x < row.length; x++) buffer.setCell(x, y, { char: row[x] })
            })
            return buffer
        }

        // When
        screen.write(inline.render(frame(['one'])))
        screen.write(inline.render(frame(['one', 'two 好'])))
        screen.write(inline.render(frame(['one', 'two 好', 'three'])))
        screen.write(inline.render(frame(['one', 'final'])))

        // Then: zone rows reflect the last frame; nothing above row 2 touched
        assert.equal(screen.rowText(2), 'one')
        assert.equal(screen.rowText(3), 'final')
        assert.equal(screen.rowText(4), '')
    })
})
