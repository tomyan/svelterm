import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTermRenderer } from '../src/renderer/index.js'
import { TermNode, SvtRegionNode } from '../src/renderer/node.js'
import { CellBuffer, type Cell } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { computeLayout } from '../src/layout/engine.js'
import { resolveStyles } from '../src/css/compute.js'
import { parseCSS } from '../src/css/parser.js'

const renderer = createTermRenderer()

function makeCell(overrides: Partial<Cell> = {}): Cell {
    return {
        char: 'X', fg: 'red', bg: 'default',
        bold: false, italic: false, underline: false,
        strikethrough: false, dim: false,
        ...overrides,
    }
}

interface Setup {
    root: TermNode
    region: SvtRegionNode
    render: () => CellBuffer
}

function setupRegionTree(opts: { width: number; height: number; css: string }): Setup {
    const root = new TermNode('element', 'root')
    const region = renderer.createElement('svt-region') as SvtRegionNode
    renderer.insert(root, region, null)
    const stylesheet = parseCSS(opts.css)
    const render = (): CellBuffer => {
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, opts.width, opts.height)
        const buffer = new CellBuffer(opts.width, opts.height)
        paint(root, buffer, styles, layout)
        return buffer
    }
    return { root, region, render }
}

function listenResize(node: TermNode): Array<{ cols: number; rows: number }> {
    const events: Array<{ cols: number; rows: number }> = []
    let handlers = node.listeners.get('resize')
    if (!handlers) {
        handlers = new Set()
        node.listeners.set('resize', handlers)
    }
    handlers.add((event: any) => events.push(event.data))
    return events
}

describe('svt-region', () => {

    describe('node creation', () => {
        it('createElement("svt-region") returns an SvtRegionNode', () => {
            // When
            const node = renderer.createElement('svt-region')

            // Then
            assert.ok(node instanceof SvtRegionNode)
            assert.equal(node.tag, 'svt-region')
        })

        it('createElement for any other tag returns a regular TermNode', () => {
            // When
            const node = renderer.createElement('div')

            // Then
            assert.ok(!(node instanceof SvtRegionNode))
            assert.ok(node instanceof TermNode)
        })
    })

    describe('cell source', () => {
        it('paints cells from the cell source at the region\'s allocated box', () => {
            // Given — a 10×3 region inside a 20×10 terminal
            const { region, render } = setupRegionTree({
                width: 20, height: 10,
                css: 'svt-region { width: 10cell; height: 3cell; }',
            })
            region.setCellSource((_col, _row) => makeCell({ char: 'X', fg: 'red' }))

            // When
            const buffer = render()

            // Then — cells inside the box are X/red, cells outside stay empty
            for (let r = 0; r < 10; r++) {
                for (let c = 0; c < 20; c++) {
                    const cell = buffer.getCell(c, r)!
                    const inside = c < 10 && r < 3
                    if (inside) {
                        assert.equal(cell.char, 'X', `cell (${c},${r}) inside region should be X`)
                        assert.equal(cell.fg, 'red')
                    } else {
                        assert.equal(cell.char, ' ', `cell (${c},${r}) outside region should be empty`)
                    }
                }
            }
        })

        it('passes local (col, row) coordinates to cell source', () => {
            // Given — a region at the top-left, plus visited-coord recorder
            const { region, render } = setupRegionTree({
                width: 20, height: 10,
                css: 'svt-region { width: 6cell; height: 4cell; }',
            })
            const visited: Array<[number, number]> = []
            region.setCellSource((col, row) => {
                visited.push([col, row])
                return makeCell()
            })

            // When
            render()

            // Then — cellSource was called with (0,0)..(5,3) — local to region
            assert.ok(visited.some(([c, r]) => c === 0 && r === 0))
            assert.ok(visited.some(([c, r]) => c === 5 && r === 3))
            assert.ok(visited.every(([c, r]) => c >= 0 && c < 6 && r >= 0 && r < 4))
        })

        it('renders nothing when no cell source is set', () => {
            // Given
            const { render } = setupRegionTree({
                width: 20, height: 10,
                css: 'svt-region { width: 10cell; height: 3cell; }',
            })

            // When
            const buffer = render()

            // Then — buffer is all empty (region didn't crash, didn't produce cells)
            for (let r = 0; r < 10; r++) {
                for (let c = 0; c < 20; c++) {
                    assert.equal(buffer.getCell(c, r)!.char, ' ')
                }
            }
        })
    })

    describe('resize event', () => {
        it('fires onresize with allocated cols/rows on first paint', () => {
            // Given
            const { region, render } = setupRegionTree({
                width: 20, height: 10,
                css: 'svt-region { width: 12cell; height: 4cell; }',
            })
            const events = listenResize(region)

            // When
            render()

            // Then
            assert.deepEqual(events, [{ cols: 12, rows: 4 }])
        })

        it('does not re-fire when allocated size is unchanged across paints', () => {
            // Given
            const { region, render } = setupRegionTree({
                width: 20, height: 10,
                css: 'svt-region { width: 12cell; height: 4cell; }',
            })
            const events = listenResize(region)

            // When — paint twice
            render()
            render()

            // Then
            assert.equal(events.length, 1)
        })

        it('fires resize again when allocated size changes', () => {
            // Given
            const root = new TermNode('element', 'root')
            const region = renderer.createElement('svt-region') as SvtRegionNode
            renderer.insert(root, region, null)
            const events = listenResize(region)

            const renderWithCss = (css: string) => {
                const stylesheet = parseCSS(css)
                const styles = resolveStyles(root, stylesheet)
                const layout = computeLayout(root, styles, 20, 10)
                const buffer = new CellBuffer(20, 10)
                paint(root, buffer, styles, layout)
            }
            renderWithCss('svt-region { width: 12cell; height: 4cell; }')

            // When — change size
            renderWithCss('svt-region { width: 8cell; height: 3cell; }')

            // Then
            assert.equal(events.length, 2)
            assert.deepEqual(events[0], { cols: 12, rows: 4 })
            assert.deepEqual(events[1], { cols: 8, rows: 3 })
        })
    })
})
