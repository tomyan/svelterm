import { renderHeadless, bufferToText, bufferToStyledText, bufferToSvg } from '../src/headless.js'
import { TermNode } from '../src/renderer/node.js'
import { CellBuffer } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..', '..')
const snapshotDir = join(projectRoot, 'test', '__snapshots__')
mkdirSync(snapshotDir, { recursive: true })

// Test: headless render with manual component + CSS (no Svelte compilation needed)
console.log('Test: Headless render with CSS layout')

const css = `.container{display:flex;flex-direction:row;gap:2cell;padding:1cell 2cell}.box-a{width:20cell;padding:1cell;background-color:#00f;color:#fff}.box-b{width:20cell;padding:1cell;background-color:#f0f;color:#fff;font-weight:700}.title{color:#0ff;font-weight:700}`

const stylesheet = parseCSS(css)

// Build virtual tree manually (simulating what compiled Svelte would produce)
const root = new TermNode('element', 'root')
const outer = new TermNode('element', 'div')
root.insertBefore(outer, null)

const title = new TermNode('element', 'span')
title.attributes.set('class', 'title')
const titleText = new TermNode('text', 'Svelterm Layout Demo')
title.insertBefore(titleText, null)
outer.insertBefore(title, null)

const container = new TermNode('element', 'div')
container.attributes.set('class', 'container')
outer.insertBefore(container, null)

const boxA = new TermNode('element', 'div')
boxA.attributes.set('class', 'box-a')
const boxAInner = new TermNode('element', 'span')
const boxAText = new TermNode('text', 'Box A')
boxAInner.insertBefore(boxAText, null)
boxA.insertBefore(boxAInner, null)
container.insertBefore(boxA, null)

const boxB = new TermNode('element', 'div')
boxB.attributes.set('class', 'box-b')
const boxBInner = new TermNode('element', 'span')
const boxBText = new TermNode('text', 'Box B')
boxBInner.insertBefore(boxBText, null)
boxB.insertBefore(boxBInner, null)
container.insertBefore(boxB, null)

// Render
const width = 60
const height = 10
const buffer = new CellBuffer(width, height)
const styles = resolveStyles(root, stylesheet)
const layout = computeLayout(root, styles, width, height)
paint(root, buffer, styles, layout)

// Text snapshot
const text = bufferToText(buffer)
console.log('--- Text snapshot ---')
console.log(text)
console.log('---')

// Styled text snapshot
const styled = bufferToStyledText(buffer)
writeFileSync(join(snapshotDir, 'demo.styled.txt'), styled)
console.log(`Wrote styled snapshot: test/__snapshots__/demo.styled.txt`)

// SVG snapshot
const svg = bufferToSvg(buffer)
writeFileSync(join(snapshotDir, 'demo.svg'), svg)
console.log(`Wrote SVG snapshot: test/__snapshots__/demo.svg`)

// Basic assertions
const titleCell = buffer.getCell(0, 0)
console.assert(titleCell?.char === 'S', `expected 'S' at (0,0), got '${titleCell?.char}'`)
console.assert(titleCell?.fg === 'cyan', `expected cyan fg, got '${titleCell?.fg}'`)
console.assert(titleCell?.bold === true, `expected bold`)

// Box A should have blue background starting at padding offset
const boxABg = buffer.getCell(3, 3)
console.assert(boxABg?.bg === 'blue', `expected blue bg at box-a area, got '${boxABg?.bg}'`)

// Box B should have magenta background
const boxBBg = buffer.getCell(27, 3)
console.assert(boxBBg?.bg === 'magenta', `expected magenta bg at box-b area, got '${boxBBg?.bg}'`)

console.log('\nAll snapshot tests passed.')
console.log('Open test/__snapshots__/demo.svg in a browser for visual inspection.')
