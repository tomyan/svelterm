# Integration Tests & Demos Plan

## Goal

Validate the full rendering pipeline end-to-end (CSS → style resolution → layout → paint → buffer → diff) and create compelling demos that exercise and showcase svelterm's feature set.

## Part 1: Integration Tests

Integration tests mount a Svelte component headlessly, render it, mutate state, and assert on the resulting buffer. They test the seams between subsystems that unit tests don't cover.

### 1.1 Full Pipeline Tests (`test/integration/pipeline.test.ts`)
Tests that exercise: parse CSS → resolve styles → compute layout → paint → buffer output.

- **Basic text rendering**: Mount component with `<p>Hello</p>`, assert "Hello" appears at correct position
- **Styled text**: `color: red; font-weight: bold` → assert cell has correct fg/bold flags
- **Background fill**: `background-color: blue` on a div → assert cells within the div have blue bg
- **Nested elements**: `<div><span>inner</span></div>` with different styles → assert style inheritance
- **Multiple children**: Three divs stacked vertically → assert correct y positions

### 1.2 Flexbox Integration (`test/integration/flexbox.test.ts`)
- **Row layout**: Three children in `flex-direction: row` → assert horizontal positions
- **Column layout**: Three children in `flex-direction: column` → assert vertical positions
- **Justify content**: `space-between` with 3 items in 30-wide container → assert spacing
- **Flex grow**: Two children, one with `flex-grow: 1` → assert it fills remaining space
- **Nested flex**: Flex inside flex → assert correct nested layout
- **Flex wrap**: Items that overflow → assert wrapping to next line

### 1.3 Grid Integration (`test/integration/grid.test.ts`)
- **Basic grid**: `grid-template-columns: 10cell 10cell` with 4 children → 2×2 grid
- **Fr units**: `grid-template-columns: 1fr 2fr` → assert proportional widths
- **Gap**: Grid with gap → assert spacing between cells

### 1.4 CSS Cascade Integration (`test/integration/cascade.test.ts`)
- **Specificity**: `.highlight` vs `div` on same element → higher specificity wins
- **Inheritance**: Parent `color: red`, child has no color → child inherits red
- **Variables**: `--accent: cyan` on root, `var(--accent)` on child → cyan applied
- **Media query**: `@media (display-mode: terminal)` rules applied, `screen` rules ignored

### 1.5 Mutation & Incremental Render (`test/integration/mutation.test.ts`)
- **Text change same length**: Change "AAA" to "BBB" → only text cells updated, positions unchanged
- **Text change different length**: Change "Hi" to "Hello World" → layout recomputed, new text painted
- **Class change**: Toggle `.active` class → style changes, repainted with new colors
- **Node insertion**: Add a child → layout updates, new child appears
- **Node removal**: Remove a child → layout reflows, old area cleared

### 1.6 Border & Visual Integration (`test/integration/visuals.test.ts`)
- **Single border**: Box with `border: single` → corner characters correct (┌┐└┘)
- **Rounded border**: `border: rounded` → (╭╮╰╯)
- **Padding**: `padding: 1cell` → content offset from border by 1
- **Overflow hidden**: Content larger than container with `overflow: hidden` → clipped
- **Text alignment**: `text-align: center` in 20-wide box → text centered

### 1.7 Input Integration (`test/integration/input.test.ts`)
- **Click handler**: Mount button with onclick, simulate click event → handler called
- **Event bubbling**: Click on child → parent handler receives event
- **Focus cycling**: Mount 3 buttons, simulate Tab → focus moves through them
- **Keyboard event**: Focused element receives keydown with correct key data

### 1.8 Table Integration (`test/integration/table.test.ts`)
- **Basic table**: `<table><tr><td>A</td><td>B</td></tr></table>` → cells positioned correctly
- **Column width**: Widest cell determines column width across all rows

---

## Part 2: Demos

Each demo is a standalone Svelte app that can be run in the terminal. They demonstrate specific features while being visually impressive. Each demo should also work as a smoke test.

### Demo 1: Dashboard (`demo/dashboard/`)
**Features exercised**: Flexbox layout, grid, borders, colors, text styling, CSS variables, real-time updates

A terminal dashboard with:
- Header bar (centered title, bold, colored background)
- 2×2 grid of stat panels (each with border, title, value)
- Values update on a timer (demonstrates reactive incremental rendering)
- Color theme via CSS variables (`--accent`, `--bg`, `--fg`)
- Responsive: panels reflow based on terminal width via percentage widths

```
╭─────────────── Dashboard ───────────────╮
│                                         │
│  ┌─ CPU ──────┐  ┌─ Memory ─────┐      │
│  │   47%      │  │   2.1 GB     │      │
│  └────────────┘  └──────────────┘      │
│  ┌─ Requests ─┐  ┌─ Errors ─────┐      │
│  │   1,247    │  │   3          │      │
│  └────────────┘  └──────────────┘      │
╰─────────────────────────────────────────╯
```

### Demo 2: Keyboard Hero (`demo/keyboard-hero/`)
**Features exercised**: Keyboard input, animation (@keyframes), focus, real-time state, CSS transitions (discrete), scoring, colors

Terminal version of the BBC Glow classic. Letters fall from the top of the screen. Type them before they reach the bottom. Features:
- Letters cascade down in columns using timed position updates
- Each column has a different color (CSS variables per column)
- Hit: letter flashes green and disappears (class toggle → style resolve)
- Miss: letter turns red at bottom, life lost
- Score display with bold/colored numbers
- Lives as colored hearts: `♥♥♥♡♡`
- Difficulty increases (speed ramps up)
- Game over overlay (absolute positioned, semi-transparent feel via dim)
- High score persistence

```
  ╭──── KEYBOARD HERO ────╮
  │  Score: 1250  ♥♥♥♡♡   │
  │                        │
  │    F                   │
  │         J              │
  │  A           K         │
  │       D                │
  │              L    S    │
  │  ─────────────────── ──│
  │  [A][S][D][F][G][H][J] │
  ╰────────────────────────╯
```

### Demo 3: Todo App (`demo/todo/`)
**Features exercised**: Text input (TextBuffer), focus management, list rendering, class toggling, event handling, scrolling

Interactive todo list with:
- Text input field at top (focus, TextBuffer for editing)
- Add button (Tab to focus, Enter to submit)
- Scrollable list of todos
- Each todo has checkbox toggle (click or Enter)
- Completed todos get strikethrough + dim styling
- Delete button per todo
- Counter showing "3 of 7 remaining"
- `:focus` pseudo-class styling on focused elements

```
  ┌─ Todo List ─────────────────┐
  │ > Buy groceries_            │
  │ [Add]                       │
  │                             │
  │ ☑ ̶W̶r̶i̶t̶e̶ ̶t̶e̶s̶t̶s̶          [×] │
  │ ☐ Fix bugs                [×] │
  │ ☐ Deploy                  [×] │
  │                             │
  │ 2 of 3 remaining           │
  └─────────────────────────────┘
```

### Demo 4: Color & Style Showcase (`demo/showcase/`)
**Features exercised**: All color formats, text decorations, border styles, background colors, opacity/dim, hyperlinks

A reference card showing every visual capability:
- ANSI color palette (8 colors × fg/bg)
- Truecolor gradient (HSL sweep)
- Text decorations: **bold**, *italic*, <u>underline</u>, ~~strikethrough~~, dim
- All border styles: single, double, rounded, heavy
- Nested borders with different styles
- Hyperlink text (OSC 8)
- CSS named color samples

```
  ╔══ Svelterm Style Showcase ══╗
  ║                              ║
  ║  Colors                      ║
  ║  ■ ■ ■ ■ ■ ■ ■ ■  (ANSI)   ║
  ║  ████████████████  (gradient)║
  ║                              ║
  ║  Text Styles                 ║
  ║  Bold  Italic  Underline     ║
  ║  Strike  Dim                 ║
  ║                              ║
  ║  Borders                     ║
  ║  ┌──┐ ╔══╗ ╭──╮ ┏━━┓        ║
  ║  └──┘ ╚══╝ ╰──╯ ┗━━┛        ║
  ╚══════════════════════════════╝
```

### Demo 5: File Browser (`demo/filebrowser/`)
**Features exercised**: Scrolling (overflow: scroll), hit testing, mouse clicks, keyboard navigation, dynamic content, container queries

A two-pane file browser:
- Left pane: directory tree (scrollable)
- Right pane: file preview
- Arrow keys navigate, Enter opens
- Mouse click selects
- Breadcrumb path at top
- File size/date in status bar
- Container query: if terminal < 60 cols, single pane mode

```
  ┌─ /Users/tom/projects ──────────────┐
  │ 📁 svelterm/          │ README.md  │
  │   📄 package.json     │            │
  │ > 📄 README.md        │ # Svelterm │
  │   📁 src/             │ Standard   │
  │   📁 test/            │ Svelte 5.. │
  │   📁 demo/            │            │
  │                       │            │
  │──────────────────────────────────── │
  │ README.md  2.1KB  Apr 3 2026       │
  └────────────────────────────────────┘
```

### Demo 6: Snake Game (`demo/snake/`)
**Features exercised**: Real-time animation (setInterval), keyboard input (arrow keys), absolute positioning, collision detection, dynamic styling, game state

Classic snake game:
- Snake body rendered as colored blocks (background-color)
- Food appears randomly (bright color)
- Arrow keys control direction
- Score increases on eating
- Game over on wall/self collision
- Speed increases with score
- Wrap-around or wall mode toggle

```
  ┌─ Snake ─── Score: 12 ──────┐
  │                             │
  │        ■                    │
  │     ■■■■                    │
  │                             │
  │              ●              │
  │                             │
  │                             │
  └─────────────────────────────┘
```

### Demo 7: Markdown Viewer (`demo/markdown/`)
**Features exercised**: Inline/block display, text wrapping, bold/italic/underline, hyperlinks, list markers, horizontal rules, heading sizes, code blocks (background)

Renders a markdown string as styled terminal output:
- `# Heading` → bold, large text
- `**bold**` → `<strong>` → bold
- `*italic*` → `<em>` → italic
- `[link](url)` → `<a href>` → underline + hyperlink
- `- item` → `<ul><li>` → bullet marker
- `---` → `<hr>` → horizontal rule
- `` `code` `` → background-color highlight
- Word wrapping within available width

---

## Iteration Plan

### Slice 1: Integration test infrastructure + pipeline tests
- Set up headless rendering test helper (mount component, get buffer, assert cells)
- Implement pipeline tests (1.1)
- Implement flexbox integration tests (1.2)

### Slice 2: CSS cascade + mutation integration tests
- Cascade integration tests (1.4)
- Mutation & incremental render tests (1.5)

### Slice 3: Visual + input integration tests
- Border & visual tests (1.6)
- Input integration tests (1.7)
- Grid and table tests (1.3, 1.8)

### Slice 4: Dashboard demo
- Most straightforward demo, exercises core layout + styling
- Validates the full mount → render → update loop works

### Slice 5: Todo App demo
- Exercises input system (focus, keyboard, TextBuffer)
- Interactive demo that proves real app patterns work

### Slice 6: Color & Style Showcase demo
- Visual reference card, exercises every rendering feature
- Good for regression testing (screenshot comparison)

### Slice 7: Keyboard Hero demo
- Complex demo: real-time animation, keyboard input, game state
- Proves the framework can handle dynamic, time-sensitive UIs

### Slice 8: Snake Game demo
- Real-time game, absolute positioning, rapid state updates
- Stress test for incremental rendering performance

### Slice 9: File Browser demo
- Scrolling, mouse, container queries
- Closest to "real app" patterns

### Slice 10: Markdown Viewer demo
- Inline/block layout, text styling, hyperlinks
- Validates the CSS engine handles complex style combinations
