# Layout

Svelterm implements CSS layout on a cell grid. Integer coordinates — every element occupies whole terminal cells. The layout engine supports flexbox, grid, block flow, table, and absolute positioning.

## Block flow

The default. Block elements stack vertically, filling available width. Inline elements flow horizontally within a line.

```svelte
<div>
    <div>First block</div>
    <div>Second block</div>
    <span>inline </span><span>text flows</span>
</div>
```

Block elements (`<div>`, `<p>`, `<h1>`, etc.) fill their parent's width by default. Inline elements (`<span>`, `<a>`, `<strong>`, etc.) shrink-wrap to content.

## Flexbox

```css
.row { display: flex; flex-direction: row; gap: 2cell; }
.col { display: flex; flex-direction: column; }
```

### Properties

| Property | Values | Default |
|---|---|---|
| `flex-direction` | `row`, `column`, `row-reverse`, `column-reverse` | `row` |
| `justify-content` | `start`, `end`, `center`, `space-between`, `space-around`, `space-evenly` | `start` |
| `align-items` | `start`, `end`, `center`, `stretch` | `start` |
| `align-self` | `auto`, `start`, `end`, `center`, `stretch` | `auto` |
| `flex-grow` | number | `0` |
| `flex-shrink` | number | `1` |
| `flex-basis` | `auto`, size value | `auto` |
| `flex-wrap` | `nowrap`, `wrap` | `nowrap` |
| `gap` | size value | `0` |
| `order` | number | `0` |
| `flex` | shorthand: `<grow> [<shrink> [<basis>]]` | — |

### Example: sidebar layout

```svelte
<style>
    .app {
        display: flex;
        flex-direction: row;
        height: 100%;
    }
    .sidebar {
        width: 20cell;
        border: single;
        border-color: gray;
    }
    .main {
        flex-grow: 1;
    }
</style>

<div class="app">
    <div class="sidebar">Navigation</div>
    <div class="main">Content</div>
</div>
```

## Grid

```css
.grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 1cell;
}
```

Grid supports `cell`, `%`, and `fr` (fractional) units for column and row templates. Children auto-flow into cells, wrapping to the next row when columns are filled.

## Table

```svelte
<table>
    <tr>
        <td>Name</td>
        <td>Status</td>
    </tr>
    <tr>
        <td>Server 1</td>
        <td>Online</td>
    </tr>
</table>
```

Column widths are determined by the widest cell across all rows. Cells fill their column width.

## Sizing

| Property | Values |
|---|---|
| `width`, `height` | `Ncell`, `N%`, `auto`, `calc()` |
| `min-width`, `min-height` | `Ncell` |
| `max-width`, `max-height` | `Ncell` |

Percentage widths resolve against the parent's width. Percentage heights resolve against the parent's height (parent must have an explicit height).

## Spacing

```css
.box {
    padding: 1cell 2cell;           /* top/bottom, left/right */
    margin: 1cell;                  /* all sides */
    margin: 1cell 2cell 1cell 2cell; /* top, right, bottom, left */
    margin: 0 auto;                 /* auto horizontal centering */
}
```

Vertical margins collapse between adjacent block siblings (the larger margin wins).

## Positioning

```css
.overlay {
    position: absolute;
    top: 2cell;
    left: 5cell;
}
```

`position: absolute` and `position: fixed` remove the element from flow and position it relative to its parent.

## Overflow and scrolling

```css
.scrollable {
    overflow: auto;
    height: 20cell;
}
```

| Value | Behaviour |
|---|---|
| `visible` | Content overflows (default) |
| `hidden` | Content clipped |
| `scroll` | Content clipped, scrollbar shown |
| `auto` | Content clipped, scrollbar when needed |

Mouse wheel scrolls `overflow: auto/scroll` containers. Tab navigation scrolls focused elements into view.

## display: contents

```css
.wrapper { display: contents; }
```

The element is invisible to layout — its children are promoted to the parent's layout context. Useful for Svelte wrapper components that shouldn't add a layout box.

## display: none

```css
.hidden { display: none; }
```

Element and all descendants are invisible and take no space.

## Element defaults

Block elements: `<div>`, `<p>`, `<h1>`–`<h6>`, `<ul>`, `<ol>`, `<li>`, `<pre>`, `<blockquote>`, `<hr>`, `<table>`

Inline elements: `<span>`, `<a>`, `<strong>`, `<em>`, `<b>`, `<i>`, `<u>`, `<code>`, `<small>`

`<input>` and `<textarea>` have an intrinsic minimum height of 1 row.
