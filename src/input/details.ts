import { TermNode, hasBooleanAttribute } from '../renderer/node.js'
import { dispatchEvent } from './dispatch.js'

/**
 * Toggle the nearest <details> from itself or its <summary>, firing a
 * toggle event with the new state, as in browsers.
 */
export function toggleDetails(node: TermNode): void {
    const details = nearestDetails(node)
    if (!details) return
    const open = !hasBooleanAttribute(details, 'open')
    if (open) {
        if (details.ctx) details.ctx.onSetAttribute(details, 'open', 'true')
        else details.attributes.set('open', 'true')
    } else {
        if (details.ctx) details.ctx.onRemoveAttribute(details, 'open')
        else details.attributes.delete('open')
    }
    dispatchEvent(details, 'toggle', { open })
}

function nearestDetails(node: TermNode): TermNode | null {
    let current: TermNode | null = node
    while (current) {
        if (current.tag === 'details') return current
        current = current.parent
    }
    return null
}
