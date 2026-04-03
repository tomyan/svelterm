import { TermNode } from '../renderer/node.js'

export interface TermEvent {
    type: string
    target: TermNode
    data?: any
    propagationStopped: boolean
    defaultPrevented: boolean
    stopPropagation(): void
    preventDefault(): void
}

function createEvent(type: string, target: TermNode, data?: any): TermEvent {
    const event: TermEvent = {
        type,
        target,
        data,
        propagationStopped: false,
        defaultPrevented: false,
        stopPropagation() { event.propagationStopped = true },
        preventDefault() { event.defaultPrevented = true },
    }
    return event
}

export function dispatchEvent(target: TermNode, type: string, data?: any): TermEvent {
    const event = createEvent(type, target, data)
    let node: TermNode | null = target

    while (node) {
        const handlers = node.listeners.get(type)
        if (handlers) {
            for (const handler of handlers) {
                handler(event)
            }
        }
        if (event.propagationStopped) break
        node = node.parent
    }

    return event
}
