import { TermNode } from '../renderer/node.js'

export function applyScrollInput(
    node: TermNode,
    key: string,
    contentHeight: number,
    viewportHeight: number,
    contentWidth?: number,
    viewportWidth?: number,
): void {
    const maxScrollY = Math.max(0, contentHeight - viewportHeight)
    const maxScrollX = Math.max(0, (contentWidth ?? 0) - (viewportWidth ?? 0))

    switch (key) {
        case 'ArrowDown':
            node.scrollTop = Math.min(node.scrollTop + 1, maxScrollY)
            break
        case 'ArrowUp':
            node.scrollTop = Math.max(node.scrollTop - 1, 0)
            break
        case 'ArrowRight':
            node.scrollLeft = Math.min(node.scrollLeft + 1, maxScrollX)
            break
        case 'ArrowLeft':
            node.scrollLeft = Math.max(node.scrollLeft - 1, 0)
            break
        case 'PageDown':
            node.scrollTop = Math.min(node.scrollTop + viewportHeight, maxScrollY)
            break
        case 'PageUp':
            node.scrollTop = Math.max(node.scrollTop - viewportHeight, 0)
            break
    }
}
