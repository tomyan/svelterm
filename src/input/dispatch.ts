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

/**
 * Dispatch an event with W3C-style capture and bubble phases.
 *
 * 1. Capture phase: root → ... → target.parent (type__capture listeners)
 * 2. Target phase: fire listeners on target (both capture and bubble)
 * 3. Bubble phase: target.parent → ... → root (type listeners)
 */
export function dispatchEvent(target: TermNode, type: string, data?: any): TermEvent {
    const event = createEvent(type, target, data)

    // Build ancestor path: [root, ..., parent]
    const path: TermNode[] = []
    let ancestor: TermNode | null = target.parent
    while (ancestor) {
        path.unshift(ancestor)
        ancestor = ancestor.parent
    }

    // Phase 1: Capture (root → target.parent)
    const captureType = type + '__capture'
    for (const node of path) {
        const handlers = node.listeners.get(captureType)
        if (handlers) {
            for (const handler of handlers) {
                handler(event)
            }
        }
        if (event.propagationStopped) return event
    }

    // Phase 2: Target (fire both capture and bubble listeners on target)
    const captureHandlers = target.listeners.get(captureType)
    if (captureHandlers) {
        for (const handler of captureHandlers) {
            handler(event)
        }
    }
    if (!event.propagationStopped) {
        const handlers = target.listeners.get(type)
        if (handlers) {
            for (const handler of handlers) {
                handler(event)
            }
        }
    }
    if (event.propagationStopped) return event

    // Phase 3: Bubble (target.parent → root)
    for (let i = path.length - 1; i >= 0; i--) {
        const handlers = path[i].listeners.get(type)
        if (handlers) {
            for (const handler of handlers) {
                handler(event)
            }
        }
        if (event.propagationStopped) break
    }

    return event
}
