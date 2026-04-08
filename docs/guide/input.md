# Input

Svelterm handles keyboard, mouse, and focus input using the same event model as the browser — events dispatch to a target element, bubble up through ancestors, and can be stopped or prevented.

## Keyboard events

```svelte
<div onkeydown={(e) => handleKey(e.data)}>
    Press a key
</div>
```

The event's `data` property contains a `KeyEvent`:

```ts
interface KeyEvent {
    key: string       // 'a', 'Enter', 'ArrowUp', 'Tab', etc.
    ctrl: boolean
    shift: boolean
    meta: boolean
}
```

### Special keys

`Enter`, `Escape`, `Backspace`, `Delete`, `Tab`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`, `Insert`

### Built-in key handling

| Key | Action |
|---|---|
| `Ctrl+C` | Exit the application |
| `Ctrl+Z` | Suspend (SIGTSTP) |
| `Tab` | Focus next focusable element |
| `Shift+Tab` | Focus previous element |
| `Enter` | Click the focused element |

These fire before your component's `onkeydown`. All other keys are dispatched to the focused element, or to the component root if nothing is focused.

## Mouse events

Mouse input is enabled by default. Click, scroll, and hover events are supported.

```svelte
<button onclick={(e) => console.log('clicked at', e.data.col, e.data.row)}>
    Click me
</button>
```

Mouse events include position data:

```ts
interface MouseEvent {
    button: 'left' | 'right' | 'middle' | 'scrollUp' | 'scrollDown'
    type: 'press' | 'release' | 'motion' | 'scroll'
    col: number
    row: number
}
```

### Click

Clicking a focusable element (`<button>`, `<input>`, `<a>`) focuses it and dispatches a `click` event. Clicking an `<a>` element opens its `href` in the default browser.

### Scroll

Mouse wheel events scroll `overflow: auto/scroll` containers. The nearest scrollable ancestor of the element under the cursor receives the scroll.

### Hover

Mouse motion sets the `:hover` pseudo-class on the element under the cursor:

```css
.item:hover {
    color: cyan;
    font-weight: bold;
}
```

## Focus management

Focusable elements: `<button>`, `<input>`, `<textarea>`, `<a>`, `<select>`

```css
button:focus {
    border-color: yellow;
    color: yellow;
}
```

Focus events fire when focus changes:

```svelte
<button
    onfocus={() => console.log('gained focus')}
    onblur={() => console.log('lost focus')}
>
    Tab to me
</button>
```

When Tab moves focus to an element outside the visible scroll region, the container scrolls to reveal it.

## Event dispatch

Events follow the W3C model with capture and bubble phases:

1. **Capture**: root → target (listeners registered on `type__capture`)
2. **Target**: fire listeners on the target
3. **Bubble**: target → root (normal listeners)

```svelte
<div onclick={(e) => {
    e.stopPropagation()    // prevent bubbling
    e.preventDefault()     // prevent default action (e.g. link navigation)
}}>
    Handled here
</div>
```

## Text input

`<input>` elements accept keyboard input automatically when focused:

```svelte
<input value="" oninput={(e) => value = e.data.value} />
```

Features:
- Character insertion at cursor position
- Backspace, Delete
- Arrow keys move cursor
- Home / End
- Ctrl+A (home), Ctrl+E (end), Ctrl+U (clear to start), Ctrl+K (clear to end)
- Horizontal scroll with overflow indicators (`…`) when text exceeds width
- Cursor rendered as inverted cell
- Bracketed paste support (paste from clipboard inserts as a single operation)

## Disabling mouse

```ts
mount(App, { css, mouse: false })
```
