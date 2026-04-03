/**
 * Default terminal stylesheet — equivalent to a browser's user-agent stylesheet.
 * Uses standard CSS properties where possible. Terminal-specific values
 * (like `border: single` and `cell` units) are values that browsers naturally ignore.
 *
 * Adapts to dark/light mode via @media (prefers-color-scheme).
 */
export const DEFAULT_STYLESHEET = `
h1, h2, h3, h4, h5, h6 { font-weight: bold; }
strong, b { font-weight: bold; }
em, i { font-style: italic; }
u { text-decoration: underline; }
s, del, strike { text-decoration: line-through; }
a { text-decoration: underline; }
pre { display: flex; }
p { margin-top: 1cell; margin-bottom: 1cell; }
h1 { margin-top: 1cell; margin-bottom: 1cell; }
h2 { margin-top: 1cell; margin-bottom: 1cell; }
h3, h4, h5, h6 { margin-top: 1cell; margin-bottom: 1cell; }
hr { height: 1cell; width: 100%; margin-top: 1cell; margin-bottom: 1cell; }
blockquote { margin-left: 2cell; border-left: true; border-style: single; border-color: gray; padding-left: 1cell; }
li { padding-left: 3cell; }
ul, ol { margin-top: 1cell; margin-bottom: 1cell; }
mark { background-color: yellow; color: black; }
kbd { border: single; border-color: gray; padding: 0 1cell; }
abbr { text-decoration: underline; }
samp { color: cyan; }
var { font-style: italic; }
dt { font-weight: bold; }
dd { margin-left: 2cell; }
figure { margin-left: 2cell; margin-right: 2cell; margin-top: 1cell; margin-bottom: 1cell; }
figcaption { font-style: italic; }

@media (prefers-color-scheme: dark) {
    code { color: cyan; }
    a { color: #5599ff; }
    mark { background-color: #666600; color: white; }
}

@media (prefers-color-scheme: light) {
    code { color: #8800cc; }
    a { color: #0044cc; }
}
`
