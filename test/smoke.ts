import { createTermRenderer, TermNode } from '../src/renderer/index.js'
import { CellBuffer } from '../src/render/buffer.js'
import { paint } from '../src/render/paint.js'
import { diffBuffers } from '../src/render/diff.js'

// Test 1: TermNode tree operations
console.log('Test 1: TermNode tree operations')
{
    const root = new TermNode('element', 'div')
    const child1 = new TermNode('text', 'Hello ')
    const child2 = new TermNode('text', 'World')

    root.insertBefore(child1, null)
    root.insertBefore(child2, null)

    console.assert(root.children.length === 2, 'root has 2 children')
    console.assert(root.collectText() === 'Hello World', `expected "Hello World", got "${root.collectText()}"`)
    console.assert(child1.parent === root, 'child1 parent is root')
    console.assert(child1.getNextSibling() === child2, 'child1 next sibling is child2')
    console.assert(child2.getNextSibling() === null, 'child2 has no next sibling')

    child1.remove()
    console.assert(root.children.length === 1, 'root has 1 child after remove')
    console.assert(root.collectText() === 'World', 'text is "World" after remove')

    console.log('  PASS')
}

// Test 2: Fragment insertion
console.log('Test 2: Fragment insertion')
{
    const root = new TermNode('element', 'div')
    const frag = new TermNode('fragment')
    const a = new TermNode('text', 'A')
    const b = new TermNode('text', 'B')
    frag.insertBefore(a, null)
    frag.insertBefore(b, null)

    root.insertBefore(frag, null)
    console.assert(root.children.length === 2, `expected 2 children, got ${root.children.length}`)
    console.assert(root.collectText() === 'AB', `expected "AB", got "${root.collectText()}"`)
    console.assert(a.parent === root, 'a parent is root (not fragment)')

    console.log('  PASS')
}

// Test 3: CellBuffer and paint
console.log('Test 3: CellBuffer and paint')
{
    const root = new TermNode('element', 'div')
    const text = new TermNode('text', 'Hello')
    root.insertBefore(text, null)

    const buffer = new CellBuffer(80, 24)
    paint(root, buffer)

    const h = buffer.getCell(0, 0)
    const e = buffer.getCell(1, 0)
    const l = buffer.getCell(2, 0)
    console.assert(h?.char === 'H', `expected 'H', got '${h?.char}'`)
    console.assert(e?.char === 'e', `expected 'e', got '${e?.char}'`)
    console.assert(l?.char === 'l', `expected 'l', got '${l?.char}'`)

    // Cell 10 should be space (empty)
    const empty = buffer.getCell(10, 0)
    console.assert(empty?.char === ' ', `expected ' ', got '${empty?.char}'`)

    console.log('  PASS')
}

// Test 4: Diff output
console.log('Test 4: Diff produces output for changed cells only')
{
    const buf1 = new CellBuffer(10, 1)
    buf1.writeText(0, 0, 'Hello')

    const buf2 = new CellBuffer(10, 1)
    buf2.writeText(0, 0, 'Hallo')

    const diff = diffBuffers(buf1, buf2)
    // Only the 'a' at position 1 should be in the diff (plus cursor move + style codes)
    console.assert(diff.includes('a'), 'diff contains the changed character "a"')
    // The diff should be short — only one cell changed
    // (can't check for absence of 'H' because ANSI cursor codes use H as suffix)
    const charCount = diff.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '').length
    console.assert(charCount === 1, `expected 1 content char in diff, got ${charCount}`)

    console.log('  PASS')
}

// Test 5: createTermRenderer interface
console.log('Test 5: createTermRenderer creates renderer with render method')
{
    const renderer = createTermRenderer()
    console.assert(typeof renderer.render === 'function', 'renderer has render method')
    console.assert(typeof renderer.createElement === 'function', 'renderer has createElement')
    console.assert(typeof renderer.createTextNode === 'function', 'renderer has createTextNode')
    console.assert(typeof renderer.insert === 'function', 'renderer has insert')

    // Test createElement
    const el = renderer.createElement('div')
    console.assert(el instanceof TermNode, 'createElement returns TermNode')
    console.assert(el.tag === 'div', 'element tag is div')

    // Test createTextNode
    const tn = renderer.createTextNode('hello')
    console.assert(tn.text === 'hello', 'text node has correct text')

    // Test setAttribute
    renderer.setAttribute(el, 'class', 'foo bar')
    console.assert(el.classes.has('foo'), 'element has class foo')
    console.assert(el.classes.has('bar'), 'element has class bar')

    // Test insert
    renderer.insert(el, tn, null)
    console.assert(el.children.length === 1, 'element has 1 child after insert')

    console.log('  PASS')
}

console.log('\nAll tests passed.')
