# Theming

Svelterm uses CSS variables for theming — the same mechanism as the web. Define color tokens on a root element, reference them throughout your components, switch themes by changing a class.

## Basic theme

```css
:root {
    --primary: cyan;
    --accent: yellow;
    --muted: gray;
    --bg: black;
    --fg: white;
}

.title { color: var(--primary); }
.value { color: var(--accent); }
.hint { color: var(--muted); opacity: dim; }
```

## Multiple themes

Define theme palettes as class selectors. Switch by changing the class on a parent element:

```svelte
<script>
    let theme = $state('dark-ocean')
</script>

<style>
    .dark-ocean {
        --primary: cyan; --accent: yellow; --border: cyan;
    }
    .dark-forest {
        --primary: green; --accent: yellow; --border: green;
    }
    .light-paper {
        --primary: #2244aa; --accent: #886600; --border: #2244aa;
    }
</style>

<div class="app {theme}">
    <span style:color="var(--primary)">{theme}</span>
    <button onclick={() => theme = 'dark-forest'}>Switch</button>
</div>
```

## Light and dark mode

Svelterm detects the terminal's background color via OSC 11 at startup, then polls every second. The detected scheme feeds into `@media (prefers-color-scheme)`:

```css
@media (prefers-color-scheme: dark) {
    :root { --bg: black; --fg: white; --primary: cyan; }
}

@media (prefers-color-scheme: light) {
    :root { --bg: #eeeeee; --fg: #111111; --primary: #0088aa; }
}
```

This works automatically — no code needed. If the user switches their terminal's color scheme, the app re-renders with the correct palette within a second.

### Color contrast

Some CSS colors have poor contrast on light backgrounds (yellow, cyan, gold). Use the media query to provide darker variants:

```css
.warning { color: yellow; }

@media (prefers-color-scheme: light) {
    .warning { color: #997700; }
}
```

## Dual-target theming

CSS variables work in both terminal and browser. Use the same tokens, with target-specific values:

```css
:root {
    --primary: cyan;
    --bg: black;
}

@media (display-mode: screen) {
    :root {
        --primary: #00b4d8;
        --bg: #1a1a2e;
    }
}
```

The terminal gets ANSI `cyan`. The browser gets hex `#00b4d8`. Same component, same variable names, different rendered values.
