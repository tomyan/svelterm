/**
 * Layout engine benchmark — measures svelterm's layout performance
 * for realistic terminal UI trees at various scales.
 *
 * Run: npx tsx bench/layout-bench.ts
 */

import { TermNode } from '../src/renderer/node.js'
import { defaultStyle, type ResolvedStyle } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'

// --- Tree builders ---

function addChild(
    parent: TermNode,
    tag: string,
    styles: Map<number, ResolvedStyle>,
    overrides?: Partial<ResolvedStyle>,
): TermNode {
    const child = new TermNode('element', tag)
    styles.set(child.id, { ...defaultStyle(tag), ...overrides })
    parent.insertBefore(child, null)
    return child
}

function addText(parent: TermNode, text: string): TermNode {
    const node = new TermNode('text', text)
    parent.insertBefore(node, null)
    return node
}

/** Simple message: a div with a text child */
function addMessage(
    parent: TermNode,
    styles: Map<number, ResolvedStyle>,
    text: string,
): TermNode {
    const msg = addChild(parent, 'div', styles, {
        display: 'block',
        paddingLeft: 2,
        paddingRight: 2,
    })
    addText(msg, text)
    return msg
}

/** Rich message: header + body with multiple paragraphs + code block */
function addRichMessage(
    parent: TermNode,
    styles: Map<number, ResolvedStyle>,
    paragraphs: number,
): TermNode {
    const msg = addChild(parent, 'div', styles, {
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        paddingTop: 1,
        paddingBottom: 1,
        paddingLeft: 2,
        paddingRight: 2,
    })

    // Header
    const header = addChild(msg, 'div', styles, {
        display: 'flex',
        flexDirection: 'row',
        gap: 1,
    })
    addChild(header, 'span', styles, { bold: true })
    addText(header.children[0], 'Assistant')
    addChild(header, 'span', styles, { fg: '#888888', dim: true })
    addText(header.children[1], '2m ago')

    // Paragraphs
    for (let i = 0; i < paragraphs; i++) {
        const p = addChild(msg, 'div', styles, { display: 'block' })
        addText(p, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.')
    }

    // Code block
    const code = addChild(msg, 'div', styles, {
        display: 'block',
        paddingTop: 1,
        paddingBottom: 1,
        paddingLeft: 2,
        paddingRight: 2,
        borderStyle: 'single',
    })
    addText(code, 'const x = 42;\nfunction hello() {\n  console.log("world");\n}')

    return msg
}

/** CLI tool output: bordered box with flex rows */
function addToolOutput(
    parent: TermNode,
    styles: Map<number, ResolvedStyle>,
    rows: number,
): TermNode {
    const tool = addChild(parent, 'div', styles, {
        display: 'flex',
        flexDirection: 'column',
        borderStyle: 'single',
        paddingLeft: 1,
        paddingRight: 1,
    })

    // Header row
    const header = addChild(tool, 'div', styles, {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
    })
    const label = addChild(header, 'span', styles, { bold: true })
    addText(label, 'grep results')
    const count = addChild(header, 'span', styles, { dim: true })
    addText(count, `${rows} matches`)

    // Result rows
    for (let i = 0; i < rows; i++) {
        const row = addChild(tool, 'div', styles, {
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
        })
        const file = addChild(row, 'span', styles, { fg: '#48cae4' })
        addText(file, `src/components/App.tsx:${100 + i}`)
        const line = addChild(row, 'span', styles)
        addText(line, `  const result = await fetchData(${i})`)
    }

    return tool
}

// --- Benchmark runner ---

interface BenchResult {
    name: string
    nodes: number
    iterations: number
    totalMs: number
    avgMs: number
    medianMs: number
    p95Ms: number
}

function bench(
    name: string,
    buildTree: () => { root: TermNode; styles: Map<number, ResolvedStyle> },
    width: number,
    height: number,
    iterations: number,
): BenchResult {
    // Build the tree once
    const { root, styles } = buildTree()

    // Count nodes
    let nodes = 0
    function countNodes(node: TermNode) {
        nodes++
        for (const child of node.children) countNodes(child)
    }
    countNodes(root)

    // Warmup
    for (let i = 0; i < 5; i++) {
        computeLayout(root, styles, width, height)
    }

    // Timed runs
    const times: number[] = []
    for (let i = 0; i < iterations; i++) {
        const start = performance.now()
        computeLayout(root, styles, width, height)
        times.push(performance.now() - start)
    }

    times.sort((a, b) => a - b)
    const totalMs = times.reduce((s, t) => s + t, 0)

    return {
        name,
        nodes,
        iterations,
        totalMs,
        avgMs: totalMs / iterations,
        medianMs: times[Math.floor(times.length / 2)],
        p95Ms: times[Math.floor(times.length * 0.95)],
    }
}

// --- Scenarios ---

function smallChat() {
    const root = new TermNode('element', 'root')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, { ...defaultStyle(), display: 'flex', flexDirection: 'column' } as ResolvedStyle)

    for (let i = 0; i < 10; i++) {
        addMessage(root, styles, `Message ${i}: Hello, this is a short message.`)
    }
    return { root, styles }
}

function mediumChat() {
    const root = new TermNode('element', 'root')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, { ...defaultStyle(), display: 'flex', flexDirection: 'column', gap: 1 } as ResolvedStyle)

    for (let i = 0; i < 50; i++) {
        if (i % 3 === 0) {
            addRichMessage(root, styles, 2)
        } else {
            addMessage(root, styles, `User prompt ${i}: Can you explain how this works in detail?`)
        }
    }
    return { root, styles }
}

function largeChat() {
    const root = new TermNode('element', 'root')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, { ...defaultStyle(), display: 'flex', flexDirection: 'column', gap: 1 } as ResolvedStyle)

    for (let i = 0; i < 200; i++) {
        if (i % 5 === 0) {
            addToolOutput(root, styles, 10)
        } else if (i % 3 === 0) {
            addRichMessage(root, styles, 3)
        } else {
            addMessage(root, styles, `Message ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`)
        }
    }
    return { root, styles }
}

function deeplyNested() {
    const root = new TermNode('element', 'root')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, { ...defaultStyle(), display: 'flex', flexDirection: 'column' } as ResolvedStyle)

    // 20 levels of nesting with siblings at each level
    let current = root
    for (let depth = 0; depth < 20; depth++) {
        const container = addChild(current, 'div', styles, {
            display: 'flex',
            flexDirection: depth % 2 === 0 ? 'column' : 'row',
            paddingLeft: 1,
        })
        // Add siblings at each level
        for (let s = 0; s < 3; s++) {
            const sibling = addChild(container, 'div', styles, { display: 'block' })
            addText(sibling, `Depth ${depth}, sibling ${s}`)
        }
        current = container
    }
    return { root, styles }
}

function gridLayout() {
    const root = new TermNode('element', 'root')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, { ...defaultStyle(), display: 'flex', flexDirection: 'column' } as ResolvedStyle)

    // 10 grids, each 4x4
    for (let g = 0; g < 10; g++) {
        const grid = addChild(root, 'div', styles, {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: 1,
        } as any)
        for (let i = 0; i < 16; i++) {
            const cell = addChild(grid, 'div', styles, {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderStyle: 'single',
            })
            addText(cell, `Cell ${i}`)
        }
    }
    return { root, styles }
}

// --- Run ---

const ITERATIONS = 100
const WIDTH = 120
const HEIGHT = 40

console.log(`\nSvelTERM Layout Benchmark`)
console.log(`${'='.repeat(70)}`)
console.log(`${WIDTH}x${HEIGHT} viewport, ${ITERATIONS} iterations each\n`)

const results = [
    bench('Small chat (10 messages)', smallChat, WIDTH, HEIGHT, ITERATIONS),
    bench('Medium chat (50 messages)', mediumChat, WIDTH, HEIGHT, ITERATIONS),
    bench('Large chat (200 messages)', largeChat, WIDTH, HEIGHT, ITERATIONS),
    bench('Deeply nested (20 levels)', deeplyNested, WIDTH, HEIGHT, ITERATIONS),
    bench('Grid layout (10x 4x4)', gridLayout, WIDTH, HEIGHT, ITERATIONS),
]

console.log(
    'Scenario'.padEnd(30),
    'Nodes'.padStart(6),
    'Avg'.padStart(10),
    'Median'.padStart(10),
    'P95'.padStart(10),
)
console.log('-'.repeat(70))

for (const r of results) {
    console.log(
        r.name.padEnd(30),
        String(r.nodes).padStart(6),
        `${r.avgMs.toFixed(2)}ms`.padStart(10),
        `${r.medianMs.toFixed(2)}ms`.padStart(10),
        `${r.p95Ms.toFixed(2)}ms`.padStart(10),
    )
}

console.log()
