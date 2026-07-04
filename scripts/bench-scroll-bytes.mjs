// Emitted-bytes: a full-screen vertical scroll, scroll-diff vs full repaint.
import { CellBuffer } from '../dist/src/render/buffer.js'
import { diffBuffers } from '../dist/src/render/diff.js'

function screen(rows, width) {
    const b = new CellBuffer(width, rows.length)
    rows.forEach((row, y) => { for (let x = 0; x < width; x++) b.setCell(x, y, { char: row[x] ?? ' ' }) })
    return b
}
const W = 80, H = 40
const base = Array.from({ length: H }, (_, i) => `line ${i}: the quick brown fox jumps`.padEnd(W).slice(0, W))
const prev = screen(base, W)
const next = screen([...base.slice(1), `line ${H}: the quick brown fox jumps`.padEnd(W).slice(0, W)], W)

const scrollBytes = diffBuffers(prev, next).length
const blank = new CellBuffer(W, H)
const fullBytes = diffBuffers(blank, next).length
console.log(`${W}x${H} scroll-by-1: scroll-diff ${scrollBytes} bytes vs full repaint ${fullBytes} bytes (${(fullBytes/scrollBytes).toFixed(0)}x smaller)`)
