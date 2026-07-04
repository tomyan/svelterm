/**
 * Head-to-head layout benchmark: svelterm vs Yoga (WASM)
 *
 * Builds equivalent trees in both engines and measures layout time.
 * Run: node bench/layout-vs-yoga.mjs
 */

import Yoga from 'yoga-layout'
import { TermNode } from '../dist/src/renderer/node.js'
import { defaultStyle } from '../dist/src/css/compute.js'
import { computeLayout } from '../dist/src/layout/engine.js'

const WIDTH = 120
const ITERATIONS = 100

// --- Svelterm tree builder ---

function svAddChild(parent, tag, styles, overrides) {
    const child = new TermNode('element', tag)
    styles.set(child.id, { ...defaultStyle(tag), ...overrides })
    parent.insertBefore(child, null)
    return child
}

function svAddText(parent, text) {
    parent.insertBefore(new TermNode('text', text), null)
}

// --- Yoga tree builder ---

function yogaAddChild(parent, config) {
    const node = Yoga.Node.create()
    if (config.flexDirection === 'column') node.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN)
    else if (config.flexDirection === 'row') node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW)
    if (config.gap) node.setGap(Yoga.GUTTER_ALL, config.gap)
    if (config.paddingLeft) node.setPadding(Yoga.EDGE_LEFT, config.paddingLeft)
    if (config.paddingRight) node.setPadding(Yoga.EDGE_RIGHT, config.paddingRight)
    if (config.paddingTop) node.setPadding(Yoga.EDGE_TOP, config.paddingTop)
    if (config.paddingBottom) node.setPadding(Yoga.EDGE_BOTTOM, config.paddingBottom)
    if (config.border) {
        node.setBorder(Yoga.EDGE_ALL, 1)
    }
    if (config.width) node.setWidth(config.width)
    if (config.height) node.setHeight(config.height)
    if (config.justifyContent === 'space-between') node.setJustifyContent(Yoga.JUSTIFY_SPACE_BETWEEN)
    if (config.alignItems === 'center') node.setAlignItems(Yoga.ALIGN_CENTER)
    if (config.flexGrow) node.setFlexGrow(config.flexGrow)
    parent.insertChild(node, parent.getChildCount())
    return node
}

function yogaAddText(parent, text, availWidth) {
    const node = Yoga.Node.create()
    const textLen = text.length
    // Use measure function like Ink does — Yoga calls this during layout
    node.setMeasureFunc((width, widthMode, height, heightMode) => {
        const w = widthMode === Yoga.MEASURE_MODE_UNDEFINED ? (availWidth || WIDTH) : width
        const lines = Math.ceil(textLen / Math.max(1, w))
        return { width: Math.min(textLen, w), height: lines }
    })
    parent.insertChild(node, parent.getChildCount())
    return node
}

function freeYogaTree(node) {
    for (let i = node.getChildCount() - 1; i >= 0; i--) {
        freeYogaTree(node.getChild(i))
    }
    node.free()
}

// --- Scenarios ---

function buildSimpleMessages(n) {
    // Svelterm
    const svRoot = new TermNode('element', 'root')
    const svStyles = new Map()
    svStyles.set(svRoot.id, { ...defaultStyle(), display: 'flex', flexDirection: 'column' })
    for (let i = 0; i < n; i++) {
        const msg = svAddChild(svRoot, 'div', svStyles, { paddingLeft: 2 })
        svAddText(msg, 'Message ' + i + ': Hello, this is a chat message with some content.')
    }

    // Yoga
    const yRoot = Yoga.Node.create()
    yRoot.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN)
    yRoot.setWidth(WIDTH)
    for (let i = 0; i < n; i++) {
        const msg = yogaAddChild(yRoot, { flexDirection: 'column', paddingLeft: 2 })
        yogaAddText(msg, 'Message ' + i + ': Hello, this is a chat message with some content.', WIDTH - 2)
    }

    return { svRoot, svStyles, yRoot, name: `${n} simple messages` }
}

function buildStructuredMessages(n) {
    // Svelterm
    const svRoot = new TermNode('element', 'root')
    const svStyles = new Map()
    svStyles.set(svRoot.id, { ...defaultStyle(), display: 'flex', flexDirection: 'column', gap: 1 })
    for (let i = 0; i < n; i++) {
        const msg = svAddChild(svRoot, 'div', svStyles, {
            display: 'flex', flexDirection: 'column', gap: 1,
            paddingLeft: 2, paddingRight: 2,
        })
        const header = svAddChild(msg, 'div', svStyles, { display: 'flex', flexDirection: 'row', gap: 1 })
        const name = svAddChild(header, 'span', svStyles, { bold: true })
        svAddText(name, 'Assistant')
        const time = svAddChild(header, 'span', svStyles, { dim: true })
        svAddText(time, '2m ago')
        const body = svAddChild(msg, 'div', svStyles, {})
        svAddText(body, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.')
        const code = svAddChild(msg, 'div', svStyles, {
            borderStyle: 'single', paddingLeft: 1, paddingRight: 1,
        })
        svAddText(code, 'const x = 42; function hello() { return x; }')
    }

    // Yoga
    const yRoot = Yoga.Node.create()
    yRoot.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN)
    yRoot.setWidth(WIDTH)
    yRoot.setGap(Yoga.GUTTER_ALL, 1)
    for (let i = 0; i < n; i++) {
        const msg = yogaAddChild(yRoot, { flexDirection: 'column', gap: 1, paddingLeft: 2, paddingRight: 2 })
        const header = yogaAddChild(msg, { flexDirection: 'row', gap: 1 })
        const name = yogaAddChild(header, {})
        yogaAddText(name, 'Assistant', 20)
        const time = yogaAddChild(header, {})
        yogaAddText(time, '2m ago', 20)
        const body = yogaAddChild(msg, {})
        yogaAddText(body, 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.', WIDTH - 4)
        const code = yogaAddChild(msg, { border: true, paddingLeft: 1, paddingRight: 1 })
        yogaAddText(code, 'const x = 42; function hello() { return x; }', WIDTH - 8)
    }

    return { svRoot, svStyles, yRoot, name: `${n} structured messages` }
}

// --- Runner ---

function countNodes(node) {
    let count = 1
    for (const child of (node.children || [])) count += countNodes(child)
    return count
}

function countYogaNodes(node) {
    let count = 1
    for (let i = 0; i < node.getChildCount(); i++) count += countYogaNodes(node.getChild(i))
    return count
}

function benchmark(scenario) {
    const { svRoot, svStyles, yRoot, name } = scenario
    const svNodes = countNodes(svRoot)
    const yNodes = countYogaNodes(yRoot)

    // Warmup
    for (let i = 0; i < 5; i++) {
        computeLayout(svRoot, svStyles, WIDTH, 40)
        yRoot.calculateLayout(WIDTH, undefined, Yoga.DIRECTION_LTR)
    }

    // Svelterm timed
    const svTimes = []
    for (let i = 0; i < ITERATIONS; i++) {
        const t = performance.now()
        computeLayout(svRoot, svStyles, WIDTH, 40)
        svTimes.push(performance.now() - t)
    }

    // Yoga timed
    const yTimes = []
    // Collect leaf nodes for marking dirty
    function collectLeaves(node, leaves) {
        if (node.getChildCount() === 0) { leaves.push(node); return }
        for (let i = 0; i < node.getChildCount(); i++) collectLeaves(node.getChild(i), leaves)
    }
    const leaves = []
    collectLeaves(yRoot, leaves)
    for (let i = 0; i < ITERATIONS; i++) {
        // Mark all leaves dirty to force full recalculation
        for (const leaf of leaves) leaf.markDirty()
        const t = performance.now()
        yRoot.calculateLayout(WIDTH, undefined, Yoga.DIRECTION_LTR)
        yTimes.push(performance.now() - t)
    }

    svTimes.sort((a, b) => a - b)
    yTimes.sort((a, b) => a - b)

    const svMedian = svTimes[Math.floor(svTimes.length / 2)]
    const yMedian = yTimes[Math.floor(yTimes.length / 2)]
    const ratio = yMedian / svMedian

    console.log(
        name.padEnd(30),
        String(svNodes).padStart(6),
        (svMedian.toFixed(2) + 'ms').padStart(10),
        (yMedian.toFixed(2) + 'ms').padStart(10),
        (ratio.toFixed(1) + 'x').padStart(8),
    )

    freeYogaTree(yRoot)
}

// --- Run ---

console.log(`\nLayout Benchmark: SvelTERM vs Yoga (WASM)`)
console.log(`${'='.repeat(70)}`)
console.log(`${WIDTH} cols, ${ITERATIONS} iterations, median times\n`)

console.log(
    'Scenario'.padEnd(30),
    'Nodes'.padStart(6),
    'SvelTERM'.padStart(10),
    'Yoga'.padStart(10),
    'Ratio'.padStart(8),
)
console.log('-'.repeat(70))

benchmark(buildSimpleMessages(10))
benchmark(buildSimpleMessages(50))
benchmark(buildSimpleMessages(200))
benchmark(buildStructuredMessages(10))
benchmark(buildStructuredMessages(50))
benchmark(buildStructuredMessages(200))
benchmark(buildSimpleMessages(1000))

console.log()
