import { TermNode } from '../renderer/node.js'

/**
 * Mirror the element's maxlength/readonly attributes onto its TextBuffer
 * before each edit, so attribute changes made after focus apply
 * immediately (Svelte removes boolean attributes when false).
 */
export function syncEditConstraints(node: TermNode): void {
    if (!node.textBuffer) return
    const max = node.attributes.get('maxlength')
    const parsed = max !== undefined ? parseInt(max, 10) : NaN
    node.textBuffer.maxLength = Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    const readonly = node.attributes.get('readonly')
    node.textBuffer.readOnly = readonly !== undefined && readonly !== 'false'
    node.textBuffer.multiline = node.tag === 'textarea'
}
