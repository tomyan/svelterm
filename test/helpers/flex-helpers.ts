import { TermNode } from '../../src/renderer/node.js'
import { defaultStyle, type ResolvedStyle } from '../../src/css/compute.js'
import { computeLayout } from '../../src/layout/engine.js'

export function makeTree(setup: (root: TermNode, styles: Map<number, ResolvedStyle>) => void, width = 40, height = 20) {
    const root = new TermNode('element', 'root')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, defaultStyle('div'))
    setup(root, styles)
    return computeLayout(root, styles, width, height)
}

export function addChild(parent: TermNode, styles: Map<number, ResolvedStyle>, overrides?: Partial<ResolvedStyle>): TermNode {
    const child = new TermNode('element', 'div')
    styles.set(child.id, { ...defaultStyle('div'), ...overrides })
    parent.insertBefore(child, null)
    return child
}

export function addText(parent: TermNode, text: string): TermNode {
    const node = new TermNode('text', text)
    parent.insertBefore(node, null)
    return node
}

export function flexRow(overrides?: Partial<ResolvedStyle>): Partial<ResolvedStyle> {
    return { ...defaultStyle(), display: 'flex', flexDirection: 'row', ...overrides } as any
}

export function flexCol(overrides?: Partial<ResolvedStyle>): Partial<ResolvedStyle> {
    return { ...defaultStyle(), display: 'flex', flexDirection: 'column', ...overrides } as any
}
