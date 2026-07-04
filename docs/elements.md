# Elements, input and events

What HTML renders to on the grid, how form controls behave, and how
events reach your handlers. Anything unlisted renders as a plain box per
its display default.

## Text and structure

Headings, paragraphs, lists (`ul`/`ol` with markers), `blockquote`,
`pre`, `hr` (a `─` rule), `figure`, `dl`, and the text-level elements
(`strong`/`b`, `em`/`i`, `u`, `s`/`del`, `mark`, `code`, `kbd`, `abbr`,
`samp`, `var`) carry a browser-like UA stylesheet in cells. `img`,
`video`, `canvas`, and `iframe` are not rendered (inline images are a
planned, separate feature).

## Links

`<a>` is underlined and focusable. `Enter` or a click fires `click`; if
unprevented, the `href` opens in the local browser.

## Form controls

| Control | Rendering | Interaction |
|---|---|---|
| `input` (text) | one-row editor on the grid | readline-style editing with a real cursor; `input` events carry `{ value, cursor }` |
| `textarea` | multi-line editor | as above |
| `input type="checkbox"` | `[x]` / `[ ]` (3×1) | `Space` or click toggles; `change`/`input` carry `{ checked, value }` |
| `input type="radio"` | `(•)` / `( )` | selecting unchecks same-`name` radios across the tree; never untoggles itself |
| `select` + `option`/`optgroup` | selected label + `▾`, sized to the longest option | popup-less cycling: `ArrowUp`/`ArrowDown` move with wraparound, `Space`/`Enter`/click advance; `change` carries `{ value }` |
| `button` | centred text, stylable | `Enter`/click dispatch `click` |
| `progress` / `meter` | 20×1 block bar: `█` fill, eighth-block partials, `░` track | `value`/`max` (+`min` for meter); no value = indeterminate track |
| `details` / `summary` | ▶/▼ disclosure marker | `Enter`/click toggles `open`; fires `toggle` with `{ open }`; closed details hide non-summary children |
| `label` | plain inline text | clicking activates its control — wrapping or `for="id"` both work |

State attributes drive selectors: `:checked`, `:disabled`/`:enabled`,
`[open]`. `disabled` controls are skipped by focus traversal and swallow
clicks. DOM-compat properties exist where Svelte bindings expect them:
`el.checked`, `el.value`.

## Focus

`Tab` / `Shift+Tab` cycle `button`, `input`, `textarea`, `a`, `select`,
`summary` in document order, skipping disabled controls. Clicking a
focusable element focuses it. The focused element matches
[`:focus`](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus) —
style it; there is no default focus ring beyond your CSS.

```css
button:focus { border-color: yellow; }
```

## Keyboard

- `Enter` — activate the focused element (click / toggle / cycle).
- `Space` — toggle checkbox/radio, advance select.
- Arrows — cycle selects; move the text cursor in inputs.
- Printable keys — type into the focused input/textarea.
- Unhandled keys dispatch `keydown` to the focused element (or the tree
  root) with `{ key, ctrl, shift, meta }`.
- `Ctrl+C` exits (add `'ctrl+d'` to `run`'s `exitOn` for EOF-style
  exit). `Ctrl+Z` truly suspends: the terminal is restored for the
  shell, and `fg` re-enters modes and repaints with state intact.
- The [kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/)
  is enabled where supported, so combinations the legacy encoding can't
  express (`Ctrl+Enter`, `Shift+Space`, …) arrive with correct
  modifiers. Elsewhere the classic encoding applies.

## Modal dialogs

A `<dialog open>` captures input like a browser modal:
`Tab`/`Shift+Tab` trap inside it, focus is pulled in from outside, and
`Escape` removes `open` and dispatches a `close` event. Style it with
`position: absolute` + `z-index` to float above the page.

```svelte
{#if confirming}
    <dialog open onclose={() => confirming = false}>
        <span>Delete everything?</span>
        <button onclick={confirm}>Yes</button>
        <button onclick={() => confirming = false}>No</button>
    </dialog>
{/if}
```

## Mouse

Enabled by default: click (focus + click + default action), wheel
scrolling of `overflow: auto|scroll` boxes (with scrollbar overlays),
hover driving `:hover`. Mouse events carry cell coordinates.

## The event model

Events dispatch with W3C capture/bubble semantics through the component
tree; `stopPropagation()` and `preventDefault()` work, and default
actions (link opening, details toggling, select cycling, label
activation) respect `preventDefault()`.

Payloads ride on `event.data` — `{ value, cursor }` for text input,
`{ checked, value }` for checkables, `{ open }` for toggle,
`{ cols, rows }` for region resize. Handlers shared with the browser
should read both shapes:

```svelte
<select onchange={(e) => plan = e.data?.value ?? e.target.value}>
```
