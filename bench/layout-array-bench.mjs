/**
 * Benchmark: Map vs Array for style/box lookups in layout.
 *
 * Creates identical trees and measures layout with:
 * 1. Current Map-based approach
 * 2. Array-based approach (styles[node.id] instead of styles.get(node.id))
 *
 * Run: node bench/layout-array-bench.mjs
 */

import { TermNode } from '../dist/src/renderer/node.js'
import { defaultStyle } from '../dist/src/css/compute.js'
import { computeLayout } from '../dist/src/layout/engine.js'

const WIDTH = 120
const HEIGHT = 40
const ITERATIONS = 200

function addChild(parent, tag, styles, overrides) {
    const child = new TermNode('element', tag)
    const style = { ...defaultStyle(tag), ...overrides }
    if (styles instanceof Map) {
        styles.set(child.id, style)
    } else {
        styles[child.id] = style
    }
    parent.insertBefore(child, null)
    return child
}

function buildTree(useArray) {
    const root = new TermNode('element', 'root')
    const styles = useArray ? [] : new Map()
    const rootStyle = { ...defaultStyle(), display: 'flex', flexDirection: 'column', gap: 1 }
    if (useArray) styles[root.id] = rootStyle
    else styles.set(root.id, rootStyle)

    for (let i = 0; i < 200; i++) {
        const msg = addChild(root, 'div', styles, {
            display: 'flex', flexDirection: 'column', gap: 1,
            paddingLeft: 2, paddingRight: 2,
        })
        const header = addChild(msg, 'div', styles, {
            display: 'flex', flexDirection: 'row', gap: 1,
        })
        const name = addChild(header, 'span', styles, { bold: true })
        name.insertBefore(new TermNode('text', 'User'), null)
        const time = addChild(header, 'span', styles, { dim: true })
        time.insertBefore(new TermNode('text', '2m ago'), null)
        const body = addChild(msg, 'div', styles, {})
        body.insertBefore(new TermNode('text', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod.'), null)
        const code = addChild(msg, 'div', styles, {
            borderStyle: 'single', paddingLeft: 1, paddingRight: 1,
        })
        code.insertBefore(new TermNode('text', 'const x = 42; function hello() { return x; }'), null)
    }
    return { root, styles }
}

// --- Map-based (current) ---
const mapTree = buildTree(false)

// Warmup
for (let i = 0; i < 10; i++) computeLayout(mapTree.root, mapTree.styles, WIDTH, HEIGHT)

const mapTimes = []
for (let i = 0; i < ITERATIONS; i++) {
    const t = performance.now()
    computeLayout(mapTree.root, mapTree.styles, WIDTH, HEIGHT)
    mapTimes.push(performance.now() - t)
}
mapTimes.sort((a, b) => a - b)
const mapMedian = mapTimes[Math.floor(mapTimes.length / 2)]

// --- Array-based (experimental) ---
// computeLayout uses Map internally. To test array perf we need to
// measure just the lookup overhead separately, then estimate.
// But we can also just pass the array AS a Map-like object with get/set.

// Actually, let's measure Map.get vs array access directly on the hot path
const NODE_COUNT = 2000
const testMap = new Map()
const testArray = []
for (let i = 0; i < NODE_COUNT; i++) {
    const obj = { x: i, y: i, width: 10, height: 1 }
    testMap.set(i, obj)
    testArray[i] = obj
}

// Map.get benchmark
const mapGetTimes = []
for (let iter = 0; iter < ITERATIONS; iter++) {
    const t = performance.now()
    let sum = 0
    // Simulate layout: ~10 lookups per node (styles + boxes)
    for (let pass = 0; pass < 10; pass++) {
        for (let i = 0; i < NODE_COUNT; i++) {
            sum += testMap.get(i).x
        }
    }
    mapGetTimes.push(performance.now() - t)
}
mapGetTimes.sort((a, b) => a - b)
const mapGetMedian = mapGetTimes[Math.floor(mapGetTimes.length / 2)]

// Array access benchmark
const arrayGetTimes = []
for (let iter = 0; iter < ITERATIONS; iter++) {
    const t = performance.now()
    let sum = 0
    for (let pass = 0; pass < 10; pass++) {
        for (let i = 0; i < NODE_COUNT; i++) {
            sum += testArray[i].x
        }
    }
    arrayGetTimes.push(performance.now() - t)
}
arrayGetTimes.sort((a, b) => a - b)
const arrayGetMedian = arrayGetTimes[Math.floor(arrayGetTimes.length / 2)]

console.log(`\nMap vs Array Lookup Benchmark`)
console.log(`${'='.repeat(50)}`)
console.log()
console.log(`Full layout (200 structured, Map): ${mapMedian.toFixed(2)}ms`)
console.log()
console.log(`Isolated lookup (${NODE_COUNT} nodes × 10 lookups):`)
console.log(`  Map.get():    ${mapGetMedian.toFixed(3)}ms`)
console.log(`  array[id]:    ${arrayGetMedian.toFixed(3)}ms`)
console.log(`  Speedup:      ${(mapGetMedian / arrayGetMedian).toFixed(1)}x`)
console.log()

// Estimate: profile showed Map lookups are ~46% of total layout time
const mapOverhead = mapMedian * 0.46
const estimatedArrayLayout = mapMedian - mapOverhead + (mapOverhead * arrayGetMedian / mapGetMedian)
console.log(`Estimated layout with arrays: ${estimatedArrayLayout.toFixed(2)}ms`)
console.log(`Estimated speedup: ${(mapMedian / estimatedArrayLayout).toFixed(1)}x`)
console.log()
