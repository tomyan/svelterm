# Selectors and the cascade

The selector engine implements standard
[CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_selectors)
with spec matching semantics, plus `::before`/`::after` generated
content. Specificity, source order, and inline-`style` precedence follow
the [cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade);
`inherit`, `initial`, and `unset` work.

## Simple selectors and combinators

- Type (`div`), class (`.card`), id (`#main`), universal (`*`), and
  selector lists (`h1, h2`).
- Combinators: descendant (`nav a`), child (`ul > li`), adjacent sibling
  (`h2 + p`), general sibling (`h2 ~ p`).

## Attribute selectors

All operators, quoted or unquoted:

| Form | Matches |
|---|---|
| `[disabled]` | attribute present |
| `[type="text"]` | exact value |
| `[href^="https"]` | prefix |
| `[href$=".pdf"]` | suffix |
| `[href*="docs"]` | substring |
| `[data-tags~="beta"]` | whitespace-separated word |
| `[lang\|="en"]` | exact or dash-prefixed (`en-GB`) |

One renderer nuance: Svelte stringifies attribute values, so
`disabled={false}` arrives as the string `"false"` — svelterm's boolean
attribute handling (`:disabled`, `[open]` behaviours, focus skipping)
treats `"false"` as off.

## Pseudo-classes

- **Structural:** `:root`, `:first-child`, `:last-child`, `:only-child`,
  `:empty` (comments and empty text ignored, as in browsers),
  `:first-of-type`, `:last-of-type`, `:only-of-type`, and the full An+B
  family — `:nth-child()`, `:nth-last-child()`, `:nth-of-type()`,
  `:nth-last-of-type()` (`odd`, `even`, `3`, `2n+1`, `-n+3`…).
- **State:** `:focus` (keyboard/mouse focus), `:hover` (mouse),
  `:checked`, `:disabled`, `:enabled` (form controls only, as in
  browsers).
- **Logical:** `:not()`, `:is()`, `:where()` (zero specificity), each
  taking selector lists.

```css
tr:nth-child(even)        { background: #16181d; }
input:checked             { color: green; }
button:disabled           { opacity: dim; }
details[open] > summary   { color: cyan; }
```

## Pseudo-elements: `::before` / `::after`

Generated content renders as an inline box at the start/end of the
element (legacy single-colon syntax accepted):

```css
a[href$=".pdf"]::after { content: " [pdf]"; color: red; }
.badge::before         { content: attr(data-count) " "; font-weight: bold; }
```

`content:` supports quoted strings, `attr(x)` against the host element,
`counter(name)`, space-separated concatenation, and `none`/`""` (no
box). Pseudo boxes are invisible to `:empty` and `:nth-*`, and style
like inline elements (they inherit the host's visual attributes unless
the pseudo rule overrides them). In table-internal boxes they follow
CSS anonymous-box rules: a `::before` on a row renders as a leading
anonymous cell.

### Counters

`counter-reset` and `counter-increment` work with optional amounts:

```css
.doc     { counter-reset: sec; }
.section { counter-increment: sec; }
.section::before { content: counter(sec) ". "; }
```

Counters resolve in document order with a flat namespace — nested
elements share the same counter rather than creating a scoped one, and
`counters()` (the nested-join form) is not supported. Values update on
full style resolution, so an incremental restyle can briefly show stale
numbers.

## What re-resolves when

Selector matching is live: any attribute change (including inline
`style`, `checked`, `open`, `data-*`) re-resolves the element and its
descendants, so state-dependent rules like `details[open] > *` or
`[data-status="error"]` update as your component mutates.
