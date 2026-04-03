import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeLayout } from '../src/layout/engine.js'
import { defaultStyle, ResolvedStyle } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

function makeTree(setup: (root: TermNode, styles: Map<number, ResolvedStyle>) => void) {
    const root = new TermNode('element', 'div')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, defaultStyle('div'))
    setup(root, styles)
    return { root, styles }
}

function addChild(parent: TermNode, tag: string, styles: Map<number, ResolvedStyle>, overrides?: Partial<ResolvedStyle>): TermNode {
    const child = new TermNode('element', tag)
    const style = { ...defaultStyle(tag), ...overrides }
    styles.set(child.id, style)
    parent.insertBefore(child, null)
    return child
}

function addText(parent: TermNode, text: string): TermNode {
    const node = new TermNode('text', text)
    parent.insertBefore(node, null)
    return node
}

describe('computeLayout', () => {

    describe('text nodes', () => {
        it('text width equals character count', () => {
            const { root, styles } = makeTree((root, styles) => {
                addText(root, 'Hello')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const textNode = root.children[0]
            const box = boxes.get(textNode.id)!
            assert.equal(box.width, 5)
            assert.equal(box.height, 1)
        })

        it('empty text has zero size', () => {
            const { root, styles } = makeTree((root, styles) => {
                addText(root, '')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const box = boxes.get(root.children[0].id)!
            assert.equal(box.width, 0)
            assert.equal(box.height, 0)
        })
    })

    describe('column direction (default)', () => {
        it('stacks children vertically', () => {
            const { root, styles } = makeTree((root, styles) => {
                const a = addChild(root, 'div', styles)
                addText(a, 'Line 1')
                const b = addChild(root, 'div', styles)
                addText(b, 'Line 2')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.equal(boxes.get(root.children[0].id)!.y, 0)
            assert.equal(boxes.get(root.children[1].id)!.y, 1)
        })
    })

    describe('row direction', () => {
        it('places children side by side', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), display: 'flex', flexDirection: 'row' })
                const a = addChild(root, 'div', styles)
                addText(a, 'AAA')
                const b = addChild(root, 'div', styles)
                addText(b, 'BBB')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const boxA = boxes.get(root.children[0].id)!
            const boxB = boxes.get(root.children[1].id)!
            assert.equal(boxA.x, 0)
            assert.equal(boxA.y, 0)
            assert.equal(boxB.x, 3)
            assert.equal(boxB.y, 0)
        })
    })

    describe('padding', () => {
        it('offsets children by padding', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), paddingTop: 2, paddingLeft: 3 })
                const child = addChild(root, 'div', styles)
                addText(child, 'Hi')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const childBox = boxes.get(root.children[0].id)!
            assert.equal(childBox.x, 3)
            assert.equal(childBox.y, 2)
        })

        it('padding adds to container size', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), paddingTop: 1, paddingBottom: 1, paddingLeft: 2, paddingRight: 2 })
                const child = addChild(root, 'div', styles)
                addText(child, 'Hi')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const rootBox = boxes.get(root.id)!
            assert.equal(rootBox.width, 2 + 2 + 2) // paddingLeft + "Hi" + paddingRight
            assert.equal(rootBox.height, 1 + 1 + 1) // paddingTop + content + paddingBottom
        })
    })

    describe('gap', () => {
        it('adds space between children in column', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), display: 'flex', gap: 2 })
                const a = addChild(root, 'div', styles)
                addText(a, 'A')
                const b = addChild(root, 'div', styles)
                addText(b, 'B')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.equal(boxes.get(root.children[0].id)!.y, 0)
            assert.equal(boxes.get(root.children[1].id)!.y, 3) // 1 (height of A) + 2 (gap)
        })

        it('adds space between children in row', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), display: 'flex', flexDirection: 'row', gap: 3 })
                const a = addChild(root, 'div', styles)
                addText(a, 'AA')
                const b = addChild(root, 'div', styles)
                addText(b, 'BB')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.equal(boxes.get(root.children[0].id)!.x, 0)
            assert.equal(boxes.get(root.children[1].id)!.x, 5) // 2 (width AA) + 3 (gap)
        })
    })

    describe('explicit width and height', () => {
        it('respects fixed width', () => {
            const { root, styles } = makeTree((root, styles) => {
                addChild(root, 'div', styles, { width: 30 })
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.equal(boxes.get(root.children[0].id)!.width, 30)
        })

        it('respects fixed height', () => {
            const { root, styles } = makeTree((root, styles) => {
                addChild(root, 'div', styles, { height: 10 })
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.equal(boxes.get(root.children[0].id)!.height, 10)
        })

        it('resolves percentage width', () => {
            const { root, styles } = makeTree((root, styles) => {
                addChild(root, 'div', styles, { width: '50%' })
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.equal(boxes.get(root.children[0].id)!.width, 40)
        })
    })

    describe('flex-grow', () => {
        it('distributes free space proportionally', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), display: 'flex', flexDirection: 'row', width: 30 })
                const a = addChild(root, 'div', styles, { flexGrow: 1 })
                addText(a, 'A')
                const b = addChild(root, 'div', styles, { flexGrow: 1 })
                addText(b, 'B')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const widthA = boxes.get(root.children[0].id)!.width
            const widthB = boxes.get(root.children[1].id)!.width
            // Each gets 1 char content + half of remaining space
            assert.equal(widthA, widthB)
            assert.ok(widthA > 1)
        })
    })

    describe('min/max constraints', () => {
        it('enforces min-width', () => {
            const { root, styles } = makeTree((root, styles) => {
                addChild(root, 'div', styles, { minWidth: 20 })
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.ok(boxes.get(root.children[0].id)!.width >= 20)
        })

        it('enforces max-width', () => {
            const { root, styles } = makeTree((root, styles) => {
                const child = addChild(root, 'div', styles, { maxWidth: 10 })
                addText(child, 'This is a long line of text that exceeds max')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            assert.ok(boxes.get(root.children[0].id)!.width <= 10)
        })
    })

    describe('display: none', () => {
        it('hidden elements have zero size', () => {
            const { root, styles } = makeTree((root, styles) => {
                addChild(root, 'div', styles, { display: 'none' })
            })
            const boxes = computeLayout(root, styles, 80, 24)
            // display:none returns {0,0} and doesn't get a box
            assert.equal(boxes.has(root.children[0].id), false)
        })
    })

    describe('justify-content', () => {
        it('center positions children in the middle', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), display: 'flex', flexDirection: 'row', width: 20, justifyContent: 'center' })
                const a = addChild(root, 'div', styles)
                addText(a, 'Hi')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const childBox = boxes.get(root.children[0].id)!
            assert.equal(childBox.x, 9) // (20 - 2) / 2 = 9
        })

        it('end positions children at the end', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), display: 'flex', flexDirection: 'row', width: 20, justifyContent: 'end' })
                const a = addChild(root, 'div', styles)
                addText(a, 'Hi')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const childBox = boxes.get(root.children[0].id)!
            assert.equal(childBox.x, 18) // 20 - 2 = 18
        })
    })

    describe('align-items', () => {
        it('center aligns on cross axis', () => {
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, { ...defaultStyle('div'), display: 'flex', flexDirection: 'row', height: 10, alignItems: 'center' })
                const a = addChild(root, 'div', styles)
                addText(a, 'Hi')
            })
            const boxes = computeLayout(root, styles, 80, 24)
            const childBox = boxes.get(root.children[0].id)!
            assert.equal(childBox.y, 4) // (10 - 1) / 2 = 4 (floor)
        })
    })
})
