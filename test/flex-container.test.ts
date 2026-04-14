/**
 * Flex container behavior: wrapping, gaps, nesting, absolute, display:contents,
 * order, zero-size items, padding/border, percentage, empty containers.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import { makeTree, addChild, addText, flexRow, flexCol } from './helpers/flex-helpers.js'

describe('nested flex containers', () => {

    it('inner flex distributes space independently', () => {
        let a: TermNode, b: TermNode, c: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            const inner = addChild(root, styles, { display: 'flex', flexDirection: 'column', flexGrow: 1 })
            a = addChild(inner, styles, {}); addText(a, 'A')
            b = addChild(inner, styles, {}); addText(b, 'B')
            c = addChild(root, styles, { flexGrow: 1 }); addText(c, 'C')
        }, 40)

        assert.equal(boxes.get(a!.id)!.width, 20)
        assert.equal(boxes.get(b!.id)!.width, 20)
        assert.equal(boxes.get(c!.id)!.width, 20)
        assert.equal(boxes.get(a!.id)!.y, boxes.get(b!.id)!.y - 1)
    })

    it('deeply nested flex-grow propagates correctly', () => {
        let leaf: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            const l1 = addChild(root, styles, { display: 'flex', flexDirection: 'row', flexGrow: 1 })
            const l2 = addChild(l1, styles, { display: 'flex', flexDirection: 'row', flexGrow: 1 })
            leaf = addChild(l2, styles, { flexGrow: 1 })
            addText(leaf, 'deep')
        }, 40)

        assert.equal(boxes.get(leaf!.id)!.width, 40)
    })
})

describe('flex-wrap', () => {

    it('items wrap to next line when exceeding container width', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ flexWrap: 'wrap' }) as any)
            for (let i = 0; i < 3; i++) {
                const item = addChild(root, styles, { width: 15 })
                addText(item, `Item ${i}`)
                items.push(item)
            }
        }, 30)

        assert.equal(boxes.get(items[0].id)!.y, boxes.get(items[1].id)!.y)
        assert.ok(boxes.get(items[2].id)!.y > boxes.get(items[0].id)!.y)
    })

    it('wrapped items with gap', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ flexWrap: 'wrap', gap: 2 }) as any)
            for (let i = 0; i < 3; i++) {
                const item = addChild(root, styles, { width: 10 })
                addText(item, `Item ${i}`)
                items.push(item)
            }
        }, 30)

        assert.equal(boxes.get(items[0].id)!.x, 0)
        assert.equal(boxes.get(items[1].id)!.x, 12)
        assert.ok(boxes.get(items[2].id)!.y > boxes.get(items[0].id)!.y)
        assert.equal(boxes.get(items[2].id)!.x, 0)
    })
})

describe('gap interactions', () => {

    it('gap does not apply before first or after last item', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ gap: 2 }) as any)
            for (let i = 0; i < 3; i++) {
                items.push(addChild(root, styles, { width: 10 }))
                addText(items[i], `${i}`)
            }
        }, 40)

        assert.equal(boxes.get(items[0].id)!.x, 0)
        assert.equal(boxes.get(items[1].id)!.x, 12)
        assert.equal(boxes.get(items[2].id)!.x, 24)
    })

    it('gap with flex-grow distributes remaining space after gaps', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ gap: 2 }) as any)
            for (let i = 0; i < 3; i++) {
                items.push(addChild(root, styles, { flexGrow: 1 }))
                addText(items[i], `${i}`)
            }
        }, 40)

        assert.equal(boxes.get(items[0].id)!.width, 12)
        assert.equal(boxes.get(items[1].id)!.width, 12)
        assert.equal(boxes.get(items[2].id)!.width, 12)
    })

    it('absolute children do not create gaps', () => {
        let a: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ gap: 5 }) as any)
            a = addChild(root, styles, { width: 10 }); addText(a, 'A')
            addChild(root, styles, { position: 'absolute', top: 0, left: 0 })
            b = addChild(root, styles, { width: 10 }); addText(b, 'B')
        }, 40)

        assert.equal(boxes.get(a!.id)!.x, 0)
        assert.equal(boxes.get(b!.id)!.x, 15)
    })
})

describe('absolute positioning within flex', () => {

    it('absolute child does not affect flex layout', () => {
        let a: TermNode, abs: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { flexGrow: 1 }); addText(a, 'A')
            abs = addChild(root, styles, { position: 'absolute', top: 5, left: 10, width: 15 })
            addText(abs, 'abs')
            b = addChild(root, styles, { flexGrow: 1 }); addText(b, 'B')
        }, 40)

        assert.equal(boxes.get(a!.id)!.width, 20)
        assert.equal(boxes.get(b!.id)!.width, 20)
        assert.equal(boxes.get(abs!.id)!.x, 10)
        assert.equal(boxes.get(abs!.id)!.y, 5)
    })
})

describe('padding and border interactions with flex', () => {

    it('padding reduces available space for flex children', () => {
        let child: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ paddingLeft: 5, paddingRight: 5 }) as any)
            child = addChild(root, styles, { flexGrow: 1 })
            addText(child, 'X')
        }, 40)

        assert.equal(boxes.get(child!.id)!.width, 30)
    })

    it('border reduces available space by 1 per side', () => {
        let child: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ borderStyle: 'single' }) as any)
            child = addChild(root, styles, { flexGrow: 1 })
            addText(child, 'X')
        }, 40)

        assert.equal(boxes.get(child!.id)!.width, 38)
    })

    it('padding + border both reduce available space', () => {
        let child: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ borderStyle: 'single', paddingLeft: 2, paddingRight: 2 }) as any)
            child = addChild(root, styles, { flexGrow: 1 })
            addText(child, 'X')
        }, 40)

        assert.equal(boxes.get(child!.id)!.width, 34)
    })
})

describe('percentage sizing in flex', () => {

    it('percentage width resolves against parent', () => {
        let child: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            child = addChild(root, styles, { width: '50%' })
            addText(child, 'half')
        }, 40)

        assert.equal(boxes.get(child!.id)!.width, 20)
    })

    it('percentage padding resolves against parent width', () => {
        let child: TermNode, text: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexCol() as any)
            child = addChild(root, styles, { paddingLeft: '10%' })
            text = new TermNode('text', 'padded')
            child.insertBefore(text, null)
        }, 40)

        assert.equal(boxes.get(text!.id)!.x, 4)
    })
})

describe('display:contents in flex', () => {

    it('contents children promoted to parent flex', () => {
        let a: TermNode, b: TermNode, c: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            const contents = addChild(root, styles, { display: 'contents' })
            a = addChild(contents, styles, { flexGrow: 1 }); addText(a, 'A')
            b = addChild(contents, styles, { flexGrow: 1 }); addText(b, 'B')
            c = addChild(root, styles, { flexGrow: 1 }); addText(c, 'C')
        }, 30)

        assert.equal(boxes.get(a!.id)!.width, 10)
        assert.equal(boxes.get(b!.id)!.width, 10)
        assert.equal(boxes.get(c!.id)!.width, 10)
    })
})

describe('zero-size and hidden items in flex', () => {

    it('zero-width item takes no space', () => {
        let zero: TermNode, growing: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            zero = addChild(root, styles, { width: 0 })
            growing = addChild(root, styles, { flexGrow: 1 })
            addText(growing, 'fills')
        }, 40)

        assert.equal(boxes.get(zero!.id)!.width, 0)
        assert.equal(boxes.get(growing!.id)!.width, 40)
    })

    it('display:none items excluded from layout', () => {
        let a: TermNode, b: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { flexGrow: 1 }); addText(a, 'A')
            addChild(root, styles, { display: 'none' })
            b = addChild(root, styles, { flexGrow: 1 }); addText(b, 'B')
        }, 40)

        assert.equal(boxes.get(a!.id)!.width, 20)
        assert.equal(boxes.get(b!.id)!.width, 20)
    })

    it('only display:none children yields zero height', () => {
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexCol() as any)
            addChild(root, styles, { display: 'none' })
            addChild(root, styles, { display: 'none' })
        }, 40)

        const rootBox = [...boxes.values()][0]
        assert.equal(rootBox.height, 0)
    })

    it('items summing to exactly container width leave no free space', () => {
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            for (let i = 0; i < 3; i++) {
                items.push(addChild(root, styles, { width: 10 }))
                addText(items[i], `${i}`)
            }
        }, 30)

        assert.equal(boxes.get(items[0].id)!.x, 0)
        assert.equal(boxes.get(items[1].id)!.x, 10)
        assert.equal(boxes.get(items[2].id)!.x, 20)
    })
})

describe('order with negative values', () => {

    it('negative order moves item before others', () => {
        let a: TermNode, b: TermNode, c: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow() as any)
            a = addChild(root, styles, { width: 10, order: 0 })
            addText(a, 'A')
            b = addChild(root, styles, { width: 10, order: -1 })
            addText(b, 'B')
            c = addChild(root, styles, { width: 10, order: 0 })
            addText(c, 'C')
        }, 40)

        assert.equal(boxes.get(b!.id)!.x, 0)
        assert.equal(boxes.get(a!.id)!.x, 10)
        assert.equal(boxes.get(c!.id)!.x, 20)
    })
})
