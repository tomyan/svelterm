/**
 * Flex alignment, justify-content, cross-axis sizing, auto margins.
 * Spec §8, §9.5, §9.8
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import { makeTree, addChild, addText, flexRow, flexCol } from './helpers/flex-helpers.js'

describe('justify-content', () => {

    it('center aligns single item', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ justifyContent: 'center' }) as any)
            item = addChild(root, styles, { width: 10 })
            addText(item, 'mid')
        }, 40)

        assert.equal(boxes.get(item!.id)!.x, 15)
    })

    it('center-aligned non-shrinkable item overflows symmetrically', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ justifyContent: 'center' }) as any)
            item = addChild(root, styles, { width: 50, flexShrink: 0 })
            addText(item, 'wide')
        }, 40)

        assert.equal(boxes.get(item!.id)!.width, 50)
        assert.equal(boxes.get(item!.id)!.x, -5)
    })

    it('space-between with single item acts like flex-start', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ justifyContent: 'space-between' }) as any)
            item = addChild(root, styles, { width: 10 })
            addText(item, 'solo')
        }, 40)

        assert.equal(boxes.get(item!.id)!.x, 0)
    })
})

describe('cross-axis sizing', () => {

    it('stretch fills cross axis', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexCol({ height: 10, alignItems: 'stretch' }) as any)
            item = addChild(root, styles, {})
            addText(item, 'stretched')
        }, 40)

        assert.equal(boxes.get(item!.id)!.width, 40)
    })

    it('stretch is clamped by max-width', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexCol({ alignItems: 'stretch' }) as any)
            item = addChild(root, styles, { maxWidth: 20 })
            addText(item, 'X')
        }, 40)

        assert.ok(boxes.get(item!.id)!.width <= 20)
    })

    it('align-items:center positions on cross axis midpoint', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ height: 10, alignItems: 'center' }) as any)
            item = addChild(root, styles, {})
            addText(item, 'X')
        }, 40)

        const box = boxes.get(item!.id)!
        assert.ok(box.y > 0)
        assert.ok(box.y < 10)
    })
})

describe('auto margins in flex', () => {

    it('margin-left:auto pushes item to the right', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            item = addChild(root, styles, { width: 10, marginLeft: -1 as any })
            addText(item, 'right')
        }, 40)

        assert.equal(boxes.get(item!.id)!.x, 30)
    })

    it('margin-right:auto pushes next item to the right', () => {
        let a: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { width: 10, marginRight: -1 as any })
            addText(a, 'left')
            b = addChild(root, styles, { width: 10 })
            addText(b, 'right')
        }, 40)

        assert.equal(boxes.get(a!.id)!.x, 0)
        assert.equal(boxes.get(b!.id)!.x, 30)
    })

    it('margin:auto on both sides centers item', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            item = addChild(root, styles, { width: 10, marginLeft: -1 as any, marginRight: -1 as any })
            addText(item, 'mid')
        }, 40)

        assert.equal(boxes.get(item!.id)!.x, 15)
    })

    it('margin:auto centers horizontally in block context', () => {
        let child: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, defaultStyle())
            child = addChild(root, styles, {
                width: 20, marginLeft: -1 as any, marginRight: -1 as any,
            })
            addText(child, 'centered')
        }, 40)

        assert.equal(boxes.get(child!.id)!.x, 10)
        assert.equal(boxes.get(child!.id)!.width, 20)
    })
})
