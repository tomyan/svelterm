import { TermNode } from '../renderer/node.js'

export function applyScrollInput(
    node: TermNode,
    key: string,
    contentHeight: number,
    viewportHeight: number,
): void {
    const maxScroll = Math.max(0, contentHeight - viewportHeight)

    switch (key) {
        case 'ArrowDown':
            node.scrollTop = Math.min(node.scrollTop + 1, maxScroll)
            break
        case 'ArrowUp':
            node.scrollTop = Math.max(node.scrollTop - 1, 0)
            break
        case 'PageDown':
            node.scrollTop = Math.min(node.scrollTop + viewportHeight, maxScroll)
            break
        case 'PageUp':
            node.scrollTop = Math.max(node.scrollTop - viewportHeight, 0)
            break
    }
}
