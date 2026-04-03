/**
 * Default terminal stylesheet — equivalent to a browser's user-agent stylesheet.
 * Uses standard CSS properties where possible. Terminal-specific values
 * (like `border: single` and `cell` units) are values that browsers naturally ignore.
 */
export const DEFAULT_STYLESHEET = `
h1, h2, h3, h4, h5, h6 { font-weight: bold; }
strong, b { font-weight: bold; }
em, i { font-style: italic; }
u { text-decoration: underline; }
s, del, strike { text-decoration: line-through; }
code { color: cyan; }
a { text-decoration: underline; color: blue; }
pre { display: flex; }
hr { height: 1cell; width: 100%; }
li { padding-left: 3cell; }
`
