import { TermNode } from '../renderer/node.js'

export function dispatchEvent(target: TermNode, type: string, data?: any): void {
    let node: TermNode | null = target

    while (node) {
        const handlers = node.listeners.get(type)
        if (handlers) {
            for (const handler of handlers) {
                handler(data)
            }
        }
        node = node.parent
    }
}
