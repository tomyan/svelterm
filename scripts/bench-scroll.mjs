// Scroll-repaint benchmark: a 10k-row list in a 24-row viewport.
import { TermNode } from '../dist/src/renderer/node.js'
import { parseCSS } from '../dist/src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../dist/src/css/defaults.js'
import { resolveStyles } from '../dist/src/css/compute.js'
import { computeLayout } from '../dist/src/layout/engine.js'
import { paint } from '../dist/src/render/paint.js'
import { CellBuffer } from '../dist/src/render/buffer.js'

const ROWS = 10_000
const root = new TermNode('element', 'root')
const list = new TermNode('element', 'div')
list.attributes.set('class', 'list')
root.insertBefore(list, null)
for (let i = 0; i < ROWS; i++) {
    const item = new TermNode('element', 'div')
    item.attributes.set('class', 'item')
    const t = new TermNode('text', `row ${i} — some content here`)
    item.insertBefore(t, null)
    list.insertBefore(item, null)
}
const css = '.list { overflow: scroll; height: 24cell; } .item { color: cyan; }'
const sheet = parseCSS(DEFAULT_STYLESHEET + css)

let t0 = performance.now()
const styles = resolveStyles(root, sheet)
console.log('style resolve:', (performance.now() - t0).toFixed(1), 'ms')

t0 = performance.now()
const layout = computeLayout(root, styles, 80, 24)
console.log('layout:', (performance.now() - t0).toFixed(1), 'ms')

const buffer = new CellBuffer(80, 24)
t0 = performance.now()
paint(root, buffer, styles, layout)
console.log('first paint:', (performance.now() - t0).toFixed(1), 'ms')

list.scrollTop = 5000
list.scrollbarVisibleUntil = Date.now() + 60_000 // scrollbar visible, like real scrolling
const times = []
for (let i = 0; i < 20; i++) {
    list.scrollTop = 5000 + i
    const b = new CellBuffer(80, 24)
    const t = performance.now()
    paint(root, b, styles, layout)
    times.push(performance.now() - t)
}
times.sort((a, b) => a - b)
console.log('scroll repaint median:', times[10].toFixed(2), 'ms  (min', times[0].toFixed(2), 'max', times[19].toFixed(2) + ')')
