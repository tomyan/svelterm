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

describe('flex-wrap line handling', () => {

    it('wrapped items do not overlap previous line', () => {
        // Given: 5 items of width 8 in a 30-wide wrapping row with gap 1
        // Line 1: A(8)+gap(1)+B(8)+gap(1)+C(8)=26 fits
        // Line 2: D(8)+gap(1)+E(8)=17 wraps
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ flexWrap: 'wrap', maxWidth: 30, gap: 1 }) as any)
            for (let i = 0; i < 5; i++) {
                items.push(addChild(root, styles, { width: 8, height: 3 }))
                addText(items[i], String.fromCharCode(65 + i))
            }
        }, 97)

        // Then: D starts below A-C
        const aBox = boxes.get(items[0].id)!
        const dBox = boxes.get(items[3].id)!
        assert.ok(dBox.y >= aBox.y + aBox.height,
            `D (y=${dBox.y}) should start at or below A's bottom (${aBox.y + aBox.height})`)
    })

    it('stretch in wrap applies to line height, not container height', () => {
        // Given: wrapping row with a tall item on line 1, short items on line 2
        // Per spec §9.4: items stretch to their LINE's cross size, not the container
        let short1: TermNode, tall: TermNode, short2: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ flexWrap: 'wrap', maxWidth: 30, gap: 1, alignItems: 'stretch' }) as any)
            short1 = addChild(root, styles, { width: 10, height: 1 })
            addText(short1, 'S')
            tall = addChild(root, styles, { width: 10, height: 5 })
            addText(tall, 'T')
            // Third item wraps to line 2
            short2 = addChild(root, styles, { width: 15 })
            addText(short2, 'S2')
        }, 30)

        // Then: short1 should stretch to line 1 height (5, matching tall), not container height
        const s1 = boxes.get(short1!.id)!
        const t = boxes.get(tall!.id)!
        assert.equal(s1.height, t.height,
            `short1 (h=${s1.height}) should stretch to line height (${t.height})`)

        // short2 on line 2 should NOT stretch to line 1 height
        const s2 = boxes.get(short2!.id)!
        assert.ok(s2.height <= t.height,
            `short2 (h=${s2.height}) should not stretch beyond its own line height`)
        assert.ok(s2.y >= t.y + t.height,
            `short2 (y=${s2.y}) should be on line 2, below line 1 (bottom=${t.y + t.height})`)
    })

    it('container height includes all wrap lines', () => {
        // Given: wrapping row with items that create 2 lines
        let items: TermNode[] = []
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ flexWrap: 'wrap', maxWidth: 20, gap: 1 }) as any)
            for (let i = 0; i < 4; i++) {
                items.push(addChild(root, styles, { width: 8, height: 3 }))
                addText(items[i], String(i))
            }
        }, 97)

        // Then: 2 items per line (8+1+8=17 <= 20), 2 lines of height 3 + 1 gap = 7 total
        const rootBox = [...boxes.entries()].find(([id]) => id === items[0].id)?.[1]
        const lastItem = boxes.get(items[3].id)!
        const firstItem = boxes.get(items[0].id)!
        const totalHeight = lastItem.y + lastItem.height - firstItem.y
        assert.equal(totalHeight, 7, 'two lines of 3 + 1 gap = 7')
    })

    it('each wrap line computes its own cross size independently', () => {
        // Given: line 1 has tall items (h=5), line 2 has short items (h=2)
        let tall1: TermNode, tall2: TermNode, short1: TermNode
        const boxes = makeTree((root, styles) => {
            styles.set(root.id, flexRow({ flexWrap: 'wrap', maxWidth: 20, gap: 1, alignItems: 'stretch' }) as any)
            tall1 = addChild(root, styles, { width: 8, height: 5 })
            addText(tall1, 'T1')
            tall2 = addChild(root, styles, { width: 8, height: 5 })
            addText(tall2, 'T2')
            // Wraps to line 2
            short1 = addChild(root, styles, { width: 8, height: 2 })
            addText(short1, 'S1')
        }, 97)

        // Then: line 1 items have height 5, line 2 items have height 2
        assert.equal(boxes.get(tall1!.id)!.height, 5)
        assert.equal(boxes.get(tall2!.id)!.height, 5)
        assert.equal(boxes.get(short1!.id)!.height, 2)
    })
})
