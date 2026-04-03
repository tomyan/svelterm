# Svelterm — Remaining Work

Programme of work to address all known issues, ordered by dependency and impact.

## Phase 1: Incremental Rendering (complete the architecture)

### 1.1 Incremental layout
- Only re-layout subtrees with LAYOUT dirty flag
- findLayoutBoundary: walk to nearest fixed-size ancestor
- Cache layout boxes on nodes, compare before/after
- Test: change one text node, verify only its subtree re-layouts

### 1.2 Incremental paint
- Only repaint nodes with PAINT dirty flag
- Use paintNodes() for paint-only queue items
- Clear old region before repainting moved/resized nodes
- Handle z-index overlap detection
- Test: change text, verify only those cells are repainted

### 1.3 Efficient registration
- registerFocusableNodes: only on initial render + new inserts, not every render
- registerMutationCallbacks: same — only new nodes, not entire tree
- Track registered nodes to avoid duplicates
- Test: insert a node, verify only new subtree is scanned

## Phase 2: CSS Completeness

### 2.1 calc(), min(), max(), clamp()
- Parse calc(100% - 10cell) expressions
- Evaluate at layout time with available width/height
- Support min()/max()/clamp() as CSS functions
- Test: width: calc(100% - 4cell), verify computed width

### 2.2 % for padding and margin
- parseCellValue accepts % and resolves against parent dimension
- Test: padding: 10%, verify computed padding relative to parent width

### 2.3 inherit, initial, unset keywords
- inherit: use parent's computed value
- initial: use CSS initial value (per property)
- unset: inherit for inherited properties, initial for non-inherited
- Test: color: inherit, verify inherits from parent

### 2.4 currentColor
- Resolves to the element's computed color value
- Used in border-color and other properties
- Test: border-color: currentColor, verify matches color

### 2.5 Margin collapsing
- Adjacent vertical margins collapse to the larger value
- Only between block-level elements in normal flow
- Test: two divs with margin-bottom:2 and margin-top:3 have 3cell gap, not 5

### 2.6 text-decoration fix
- Should NOT inherit — parent paints decoration across descendants
- Child cannot un-set parent's underline
- Test: parent underline, child no-underline, verify child text still underlined

### 2.7 CSS Grid (display: grid)
- grid-template-columns, grid-template-rows
- grid-gap / gap
- grid-column, grid-row for item placement
- Auto-placement
- Test: 2x2 grid with explicit columns

### 2.8 order property for flex items
- Reorder children visually without changing DOM order
- Test: three items with order 3,1,2, verify visual order is 2,3,1

### 2.9 @keyframes and animation
- Parse @keyframes name { from { } to { } }
- animation property: name, duration, iteration-count
- Frame-based animation tied to terminal refresh
- Test: animate color change over frames

### 2.10 @supports
- Parse @supports (property: value) { rules }
- Evaluate against supported properties
- Test: @supports (display: flex) applies, @supports (display: grid) conditionally

### 2.11 @import
- Parse @import url
- Load and merge imported stylesheet
- Test: import a stylesheet, verify rules apply

### 2.12 @container queries
- Parse @container (min-width: N) { rules }
- Evaluate against container element dimensions (not terminal)
- Test: container query applies based on parent element width

## Phase 3: Vite Plugin and Dev Experience

### 3.1 vite-plugin-svelterm
- Sets compilerOptions.experimental.customRenderer
- Sets compilerOptions.css: 'external'
- Collects extracted CSS
- Test: plugin configures Svelte compiler correctly

### 3.2 Dev mode with HMR
- Watch .svelte files for changes
- CSS-only change: hot-swap stylesheet, repaint
- Template change: remount component, preserve state
- Script change: full component remount
- Terminal preview updates in-place

### 3.3 Build mode
- Bundle for Node execution
- Output single JS file + CSS file
- npx svelterm build produces runnable bundle

### 3.4 CLI
- npx svelterm dev — starts dev mode
- npx svelterm build — production build
- npx svelterm dev --web — browser preview

## Phase 4: Terminal Features

### 4.1 OSC 11 background detection
- Query terminal background color at startup
- Compute luminance to determine dark/light
- Set MediaContext.colorScheme accordingly
- Test: mock OSC 11 response, verify colorScheme set

### 4.2 Focus-based re-detection
- Re-query background on terminal focus events (DEC 1004)
- Update colorScheme and re-evaluate media queries
- Trigger re-render if scheme changed

### 4.3 Synchronized output (DEC 2026)
- Wrap terminal writes in BSU/ESU to prevent flicker
- Detect terminal support
- Test: verify BSU/ESU escape sequences in output

## Phase 5: Default Stylesheet Completion

### 5.1 Block-level element defaults
- blockquote: left indent + optional border
- dl, dt, dd: definition list styling
- figure, figcaption: indented with caption
- details/summary: disclosure triangle

### 5.2 Inline element defaults
- mark: highlight background
- kbd: bordered inline (keyboard input)
- abbr: dotted underline
- samp: monospace
- var: italic

### 5.3 Form element defaults
- input: bordered, focusable
- textarea: bordered, multi-line
- select: bordered with indicator
- button: already done, verify defaults

### 5.4 img element
- Display alt text when no image rendering available
- Half-block image rendering when truecolor available (future)

## Phase 6: Performance and Polish

### 6.1 Benchmark suite
- Large tree (1000 nodes) render time
- Single text change re-render time
- Scroll performance with 10000 items
- Compare full vs incremental render

### 6.2 Lazy registration
- Only register focusable/mutation callbacks on first interaction
- Don't walk tree after every render

### 6.3 Layout caching
- Cache layout boxes on nodes
- Skip re-layout when inputs unchanged (same style, same children sizes)

### 6.4 Paint region tracking
- Track which cells belong to which node
- Skip full tree walk for paint-only changes
