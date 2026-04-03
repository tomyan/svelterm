import { parseCSS } from '../src/css/parser.js'
import { matchesSelector } from '../src/css/selector.js'
import { resolveStyles } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

// Test 1: Parse CSS
console.log('Test 1: Parse minified CSS')
{
    const css = '.greeting.svelte-1ktuf6r{color:#0ff;font-weight:700}.name.svelte-1ktuf6r{color:#ff0}.container.svelte-1ktuf6r{background-color:#00f}'
    const sheet = parseCSS(css)

    console.assert(sheet.rules.length === 3, `expected 3 rules, got ${sheet.rules.length}`)

    console.assert(sheet.rules[0].selectors[0] === '.greeting.svelte-1ktuf6r',
        `expected ".greeting.svelte-1ktuf6r", got "${sheet.rules[0].selectors[0]}"`)
    console.assert(sheet.rules[0].declarations.length === 2,
        `expected 2 declarations, got ${sheet.rules[0].declarations.length}`)
    console.assert(sheet.rules[0].declarations[0].property === 'color',
        `expected "color", got "${sheet.rules[0].declarations[0].property}"`)
    console.assert(sheet.rules[0].declarations[0].value === '#0ff',
        `expected "#0ff", got "${sheet.rules[0].declarations[0].value}"`)

    console.log('  PASS')
}

// Test 2: Selector matching
console.log('Test 2: Selector matching')
{
    const node = new TermNode('element', 'span')
    node.attributes.set('class', 'greeting svelte-1ktuf6r')

    console.assert(matchesSelector(node, '.greeting.svelte-1ktuf6r'), 'matches compound class selector')
    console.assert(matchesSelector(node, '.greeting'), 'matches single class')
    console.assert(matchesSelector(node, 'span'), 'matches tag selector')
    console.assert(matchesSelector(node, 'span.greeting'), 'matches tag+class')
    console.assert(!matchesSelector(node, '.name'), 'does not match wrong class')
    console.assert(!matchesSelector(node, 'div'), 'does not match wrong tag')

    console.log('  PASS')
}

// Test 3: Resolve styles
console.log('Test 3: Resolve styles with hex colors')
{
    const css = '.greeting.svelte-1ktuf6r{color:#0ff;font-weight:700}.name.svelte-1ktuf6r{color:#ff0}'
    const sheet = parseCSS(css)

    const root = new TermNode('element', 'div')
    const greeting = new TermNode('element', 'span')
    greeting.attributes.set('class', 'greeting svelte-1ktuf6r')
    const name = new TermNode('element', 'span')
    name.attributes.set('class', 'name svelte-1ktuf6r')

    root.insertBefore(greeting, null)
    root.insertBefore(name, null)

    const styles = resolveStyles(root, sheet)

    const greetingStyle = styles.get(greeting.id)
    console.assert(greetingStyle !== undefined, 'greeting has resolved style')
    console.assert(greetingStyle!.fg === 'cyan', `expected fg "cyan", got "${greetingStyle!.fg}"`)
    console.assert(greetingStyle!.bold === true, `expected bold true, got ${greetingStyle!.bold}`)

    const nameStyle = styles.get(name.id)
    console.assert(nameStyle !== undefined, 'name has resolved style')
    console.assert(nameStyle!.fg === 'yellow', `expected fg "yellow", got "${nameStyle!.fg}"`)
    console.assert(nameStyle!.bold === false, `expected bold false, got ${nameStyle!.bold}`)

    console.log('  PASS')
}

console.log('\nAll CSS tests passed.')
