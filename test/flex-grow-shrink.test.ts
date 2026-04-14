/**
 * Flex grow/shrink distribution and min/max constraints.
 * Spec §9.7: Resolving Flexible Lengths
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import { makeTree, addChild, addText, flexRow } from './helpers/flex-helpers.js'

describe('flex-grow distribution', () => {

    it('equal grow factors split space evenly', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            for (let i = 0; i < 3; i++) {
                items.push(addChild(root, styles, { flexGrow: 1 }))
                addText(items[i], 'X')
            }
        }, 30)

        assert.equal(boxes.get(items[0].id)!.width, 10)
        assert.equal(boxes.get(items[1].id)!.width, 10)
        assert.equal(boxes.get(items[2].id)!.width, 10)
    })

    it('asymmetric grow factors split proportionally', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            items.push(addChild(root, styles, { flexGrow: 1 }))
            items.push(addChild(root, styles, { flexGrow: 2 }))
            items.push(addChild(root, styles, { flexGrow: 1 }))
            for (const item of items) addText(item, 'X')
        }, 40)

        assert.equal(boxes.get(items[0].id)!.width, 10)
        assert.equal(boxes.get(items[1].id)!.width, 20)
        assert.equal(boxes.get(items[2].id)!.width, 10)
    })

    it('flex-grow with fixed-size siblings', () => {
        let fixed: TermNode, growing: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            fixed = addChild(root, styles, { width: 10 })
            addText(fixed, 'A')
            growing = addChild(root, styles, { flexGrow: 1 })
            addText(growing, 'B')
        }, 40)

        assert.equal(boxes.get(fixed!.id)!.width, 10)
        assert.equal(boxes.get(growing!.id)!.width, 30)
    })

    it('max-width clamps flex-grow and redistributes excess', () => {
        let a: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { flexGrow: 1, maxWidth: 15 })
            addText(a, 'X')
            b = addChild(root, styles, { flexGrow: 1 })
            addText(b, 'X')
        }, 40)

        assert.equal(boxes.get(a!.id)!.width, 15)
        assert.equal(boxes.get(b!.id)!.width, 25)
    })
})

describe('flex-shrink constraints', () => {

    it('flex-shrink:0 prevents item from shrinking', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            items.push(addChild(root, styles, { width: 30, flexShrink: 0 }))
            items.push(addChild(root, styles, { width: 30, flexShrink: 1 }))
            for (const item of items) addText(item, 'X')
        }, 40)

        assert.equal(boxes.get(items[0].id)!.width, 30)
        assert.equal(boxes.get(items[1].id)!.width, 10)
    })

    it('min-width prevents shrinking below threshold', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            items.push(addChild(root, styles, { width: 20, minWidth: 15, flexShrink: 1 }))
            items.push(addChild(root, styles, { width: 20, flexShrink: 1 }))
            for (const item of items) addText(item, 'X')
        }, 25)

        assert.ok(boxes.get(items[0].id)!.width >= 15)
    })

    it('min-width overrides max-width when conflicting', () => {
        let child: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            child = addChild(root, styles, { minWidth: 20, maxWidth: 10 })
            addText(child, 'X')
        }, 40)

        assert.equal(boxes.get(child!.id)!.width, 20)
    })
})

describe('flex shorthand semantics', () => {

    it('flex:auto (grow:1 shrink:1 basis:auto) grows from content size', () => {
        let a: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' })
            addText(a, 'AA')
            b = addChild(root, styles, { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' })
            addText(b, 'BBBB')
        }, 40)

        // Then: remaining 34 split evenly, added to content sizes
        assert.equal(boxes.get(a!.id)!.width, 19)
        assert.equal(boxes.get(b!.id)!.width, 21)
    })

    it('flex:1 (grow:1 shrink:1 basis:0) splits evenly regardless of content', () => {
        let a: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { flexGrow: 1, flexShrink: 1, flexBasis: 0 })
            addText(a, 'short')
            b = addChild(root, styles, { flexGrow: 1, flexShrink: 1, flexBasis: 0 })
            addText(b, 'very long content here')
        }, 40)

        assert.equal(boxes.get(a!.id)!.width, 20)
        assert.equal(boxes.get(b!.id)!.width, 20)
    })
})

describe('flex-basis:0 vs flex-basis:auto', () => {

    it('basis:0 ignores content size — items split evenly', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            for (const t of ['A', 'BBBBBB', 'CCC']) {
                const item = addChild(root, styles, { flexGrow: 1, flexBasis: 0 })
                addText(item, t)
                items.push(item)
            }
        }, 30)

        assert.equal(boxes.get(items[0].id)!.width, 10)
        assert.equal(boxes.get(items[1].id)!.width, 10)
        assert.equal(boxes.get(items[2].id)!.width, 10)
    })

    it('basis:auto uses content size as starting point for grow', () => {
        let a: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { flexGrow: 1, flexBasis: 'auto' })
            addText(a, 'AB')
            b = addChild(root, styles, { flexGrow: 1, flexBasis: 'auto' })
            addText(b, 'ABCDEF')
        }, 40)

        assert.equal(boxes.get(a!.id)!.width, 18)
        assert.equal(boxes.get(b!.id)!.width, 22)
    })

    it('flex:none keeps item at content size', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            item = addChild(root, styles, { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' })
            addText(item, 'hello')
        }, 40)

        assert.equal(boxes.get(item!.id)!.width, 5)
    })

    it('flex-basis overrides width in flex row', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            item = addChild(root, styles, { width: 20, flexBasis: 10 })
            addText(item, 'X')
        }, 40)

        assert.equal(boxes.get(item!.id)!.width, 10)
    })

    it('flex-basis auto falls back to width', () => {
        let item: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            item = addChild(root, styles, { width: 15, flexBasis: 'auto' })
            addText(item, 'X')
        }, 40)

        assert.equal(boxes.get(item!.id)!.width, 15)
    })
})
