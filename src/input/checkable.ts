import { TermNode, hasBooleanAttribute } from '../renderer/node.js'
import { dispatchEvent } from './dispatch.js'

export function isCheckableInput(node: TermNode): boolean {
    if (node.tag !== 'input') return false
    const type = node.attributes.get('type')
    return type === 'checkbox' || type === 'radio'
}

/**
 * Toggle a checkbox, or select a radio (unchecking its name-group
 * siblings). Fires change/input events with the new checked state, as
 * Svelte's bind:checked listens for them.
 */
export function toggleCheckable(node: TermNode): void {
    if (node.attributes.get('type') === 'radio') {
        selectRadio(node)
        return
    }
    setChecked(node, !hasBooleanAttribute(node, 'checked'))
}

function selectRadio(node: TermNode): void {
    if (hasBooleanAttribute(node, 'checked')) return // radios don't untoggle
    const name = node.attributes.get('name')
    if (name) {
        uncheckGroupSiblings(treeRoot(node), node, name)
    }
    setChecked(node, true)
}

function uncheckGroupSiblings(scope: TermNode, selected: TermNode, name: string): void {
    if (scope !== selected && isCheckableInput(scope)
        && scope.attributes.get('type') === 'radio'
        && scope.attributes.get('name') === name
        && hasBooleanAttribute(scope, 'checked')) {
        clearChecked(scope)
    }
    for (const child of scope.children) uncheckGroupSiblings(child, selected, name)
}

function treeRoot(node: TermNode): TermNode {
    let root = node
    while (root.parent) root = root.parent
    return root
}

function setChecked(node: TermNode, checked: boolean): void {
    if (checked) {
        if (node.ctx) node.ctx.onSetAttribute(node, 'checked', 'true')
        else node.attributes.set('checked', 'true')
    } else {
        clearChecked(node)
    }
    // Browsers expose the control's value on change (radio groups read it)
    const detail = { checked, value: node.attributes.get('value') ?? '' }
    dispatchEvent(node, 'change', detail)
    dispatchEvent(node, 'input', detail)
}

function clearChecked(node: TermNode): void {
    if (node.ctx) node.ctx.onRemoveAttribute(node, 'checked')
    else node.attributes.delete('checked')
}
