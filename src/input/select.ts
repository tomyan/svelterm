import { TermNode, hasBooleanAttribute } from '../renderer/node.js'
import { dispatchEvent } from './dispatch.js'

/** The select's options, in document order (through optgroups). */
export function selectOptions(select: TermNode): TermNode[] {
    const options: TermNode[] = []
    collectOptions(select, options)
    return options
}

/** Index of the selected option — the first with a selected attribute, else 0. */
export function selectedIndex(select: TermNode): number {
    const options = selectOptions(select)
    const index = options.findIndex(option => hasBooleanAttribute(option, 'selected'))
    return index === -1 ? 0 : index
}

/** The selected option's value attribute, falling back to its text. */
export function selectValue(select: TermNode): string {
    const option = selectOptions(select)[selectedIndex(select)]
    if (!option) return ''
    return option.attributes.get('value') ?? option.textContent.trim()
}

/**
 * Move the selection by delta with wraparound — the popup-less cycling
 * interaction — updating selected attributes and firing change/input.
 */
export function cycleSelect(select: TermNode, delta: 1 | -1): void {
    const options = selectOptions(select)
    if (options.length === 0) return
    const current = selectedIndex(select)
    const next = (current + delta + options.length) % options.length
    if (next === current) return

    setSelected(options[current], false)
    setSelected(options[next], true)
    const value = selectValue(select)
    dispatchEvent(select, 'change', { value })
    dispatchEvent(select, 'input', { value })
}

function collectOptions(node: TermNode, out: TermNode[]): void {
    for (const child of node.children) {
        if (child.nodeType !== 'element') continue
        if (child.tag === 'option') out.push(child)
        else if (child.tag === 'optgroup') collectOptions(child, out)
    }
}

function setSelected(option: TermNode, selected: boolean): void {
    if (selected) {
        if (option.ctx) option.ctx.onSetAttribute(option, 'selected', 'true')
        else option.attributes.set('selected', 'true')
    } else {
        if (option.ctx) option.ctx.onRemoveAttribute(option, 'selected')
        else option.attributes.delete('selected')
    }
}
