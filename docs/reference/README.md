# Svelterm Reference

Authoritative reference for svelterm's authoring surface and runtime APIs.

## Layout

```
docs/reference/
├── css/
│   ├── properties/    # Per-property pages (border-style, padding, …)
│   ├── units/         # Unit pages (cell, %, …)
│   ├── at-rules/      # @media, @keyframes, …
│   └── selectors.md   # Selector reference
├── runtime/           # run(), IO, Terminal, …
└── integration/       # Svelte integration, custom renderer, …
```

## Page conventions

Each page is a standalone Markdown file with the following structure:

```markdown
---
name: border-style
category: css/properties
summary: Controls the visual appearance of the element's border.
related:
  - css/properties/border-corner
  - css/properties/border-color
---

# `border-style`

One-line description.

## Syntax

(Or `## Values` for properties with a fixed value list.)

## Examples

Each example shows the CSS, then the resulting terminal output (ASCII frame inline; later: actual rendered image).

## Notes

Caveats, terminal-vs-browser differences, edge cases.

## See also

Cross-links to related pages.
```

## Visual examples

Examples should include a small terminal "frame" rendered as Markdown so the page is readable as plain text. The site build can later replace these with real rendered images.

```
┌─────────────┐
│ hello       │
└─────────────┘
```

## Stable surface

Documented properties, values, and APIs are part of svelterm's stable surface. Behaviour changes need a corresponding doc update.
