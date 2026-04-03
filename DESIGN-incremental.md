# Incremental Rendering Design

## Problem

The current render pipeline recomputes everything on every change:

```
mutation → parse CSS → resolve ALL styles → compute ALL layout → paint ALL → diff buffer
```

This is O(n) on every mutation where n is the total number of nodes. It wastes work — most mutations only affect a small subtree. More importantly, it doesn't leverage Svelte's fine-grained reactivity at all.

## Insight

Svelte already knows exactly which state variable drives which DOM operation. The compiled output looks like:

```js
$.template_effect(() => $.set_text(textNode, `Count: ${$.get(count)}`))
```

Svelte's effect system only re-runs this function when `count` changes. It then calls our renderer's `setText(node, newValue)`. At that point, **we know exactly which node changed and what changed about it**. We don't need our own dependency tracking — Svelte has already done it.

The architecture should flow mutations directly to the affected rendering operation, bypassing tree walks for the common case.

## Architecture

### Three rendering paths

**Path 1: Paint-only (fast path)**
When only visual content changes but layout is unaffected.
- Text content changes but text length is unchanged
- Color/style changes
- Focus changes (different border color)
- Scroll offset changes

```
Svelte effect → renderer.setText(node, value) → repaint node cells → diff buffer → output
```

No style resolution, no layout computation, no tree walk. O(1) per mutation.

**Path 2: Layout-local (medium path)**
When a change affects layout of a subtree but not ancestors.
- Text length changes within a fixed-width container
- Child inserted/removed in a container with explicit dimensions
- Element size changes but parent has explicit dimensions

```
Svelte effect → renderer.insert(parent, node) → re-layout subtree → repaint subtree → diff buffer → output
```

Layout only runs for the affected subtree. O(subtree) per mutation.

**Path 3: Layout-bubble (slow path)**
When a change affects layout and the size change propagates to ancestors.
- Text length changes in an auto-sized container
- Child inserted/removed in an auto-sized container
- Any change in an auto-sized chain up to a fixed-size ancestor

```
Svelte effect → renderer.insert(parent, node) → re-layout up to fixed ancestor → repaint affected → diff buffer → output
```

Layout runs from the changed node up to the nearest ancestor with explicit dimensions, then down through affected siblings. O(path to fixed ancestor + affected siblings).

**Path 4: Full recompute (rare path)**
When everything is potentially affected.
- Terminal resize (dimensions change, media queries re-evaluate)
- CSS hot reload (stylesheet changes)
- Initial render

This is the current behaviour. It remains correct for these cases.

### How each renderer method maps to a path

| Renderer method | What changed | Path |
|---|---|---|
| `setText(node, text)` — same length | Visual only | Paint-only |
| `setText(node, text)` — different length | Content + maybe layout | Check if ancestors are fixed-size → Paint-only or Layout-bubble |
| `setAttribute(el, 'class', value)` | CSS rules may change | Style re-resolve for node + descendants → may trigger Layout |
| `setAttribute(el, 'data-focused', ...)` | :focus pseudo-class | Style re-resolve for node → Paint-only |
| `setAttribute(el, key, value)` — other | Attribute selectors may match | Style re-resolve for node |
| `insert(parent, node, anchor)` | Tree structure | Layout-local if parent is fixed-size, Layout-bubble if auto-sized |
| `remove(node)` | Tree structure | Same as insert |

### Node-level caching

Each TermNode caches its last rendering state:

```typescript
interface RenderCache {
    // Style
    resolvedStyle: ResolvedStyle | null
    classAttr: string            // last class attribute value — style cache invalidation key

    // Layout
    layoutBox: LayoutBox | null
    contentSize: { width: number; height: number } | null  // last measured content size

    // Paint
    paintedCells: { col: number; row: number; cell: Cell }[] | null  // last cells written by this node
}
```

When a mutation arrives, the renderer checks the cache:
- If `setText` with same text length → cached layout is still valid → paint-only
- If `setAttribute('class', ...)` with same value as cached → skip entirely
- If layout box is valid and only paint changed → skip layout

### Connecting to Svelte's effects

The custom renderer interface is called synchronously from Svelte's effect system. Each call is a direct response to a specific `$state` change. The connection is:

```
$state(x) changes
  → Svelte schedules effects that depend on x
  → Effects run synchronously in dependency order
  → Each effect calls renderer methods (setText, setAttribute, insert, remove)
  → Each renderer method:
      1. Mutates the TermNode
      2. Determines which rendering path is needed
      3. Queues the minimum work needed
  → After all effects complete (microtask boundary):
      4. Execute queued work in order: style → layout → paint
      5. Diff buffer
      6. Write to terminal
```

Step 3 is the key — instead of scheduling a full recompute, each mutation queues only what's needed. The queue is deduplicated: if 10 text nodes change, 10 paint-only operations are queued. If a node's class changes affecting 50 descendants, one subtree-style-resolve is queued.

### Work queue

```typescript
interface RenderQueue {
    paintOnly: Set<TermNode>           // nodes that only need repainting
    styleResolve: Set<TermNode>        // nodes that need CSS re-resolution (+ descendants)
    layoutSubtree: Set<TermNode>       // subtree roots that need re-layout
    layoutBubble: Set<TermNode>        // nodes whose size changed, need to propagate up
    fullRecompute: boolean             // terminal resize or CSS reload
}
```

The render pass processes the queue:
1. If `fullRecompute` → current behaviour, skip everything below
2. For each `styleResolve` node → re-resolve CSS for node and descendants, check if style actually changed
3. For each `layoutBubble` node → walk up to nearest fixed-size ancestor, re-layout from there down
4. For each `layoutSubtree` node → re-layout the subtree
5. For each `paintOnly` node → repaint just that node's cells
6. Diff buffer → output

### Determining the rendering path at mutation time

The critical decision: when `setText` or `insert` is called, how do we know if layout is affected?

**For setText:** Compare new text length to old text length. If same → paint-only. If different → check if the text node's container has explicit width. If yes → paint-only (container absorbs the size change). If no → layout-bubble.

**For insert/remove:** Check if the parent has explicit width AND height. If yes → layout-local (re-layout children within the parent). If no → layout-bubble.

**For setAttribute('class'):** Always style-resolve the node and descendants. If the resolved style differs from cached, check if layout-affecting properties changed (width, height, padding, margin, display, flex-*). If yes → layout. If no → paint-only.

```typescript
function isLayoutAffecting(oldStyle: ResolvedStyle, newStyle: ResolvedStyle): boolean {
    return oldStyle.display !== newStyle.display
        || oldStyle.flexDirection !== newStyle.flexDirection
        || oldStyle.width !== newStyle.width
        || oldStyle.height !== newStyle.height
        || oldStyle.paddingTop !== newStyle.paddingTop
        // ... all layout-affecting properties
        || oldStyle.marginTop !== newStyle.marginTop
}
```

### Finding the fixed-size ancestor (for layout-bubble)

Walk up the tree from the changed node. At each ancestor, check if it has explicit width and height:

```typescript
function findLayoutBoundary(node: TermNode, styles: Map<number, ResolvedStyle>): TermNode {
    let current: TermNode | null = node.parent
    while (current) {
        const style = styles.get(current.id)
        if (style && style.width !== null && style.height !== null) {
            return current  // this ancestor has fixed dimensions — layout stops here
        }
        current = current.parent
    }
    return root  // no fixed ancestor — layout from root (rare, only for fully auto-sized trees)
}
```

### Paint invalidation for overlapping elements

When a node is repainted, its new cells may overlap with other elements (z-index, absolute positioning). Two cases:

1. **The repainted node is on top** — its cells overwrite whatever was there. Correct automatically.
2. **Something is on top of the repainted node** — the overlapping element's cells must be repainted after.

For case 2, after painting dirty nodes, check if any clean node's layout box overlaps a dirty region. If so, repaint the clean node. This is O(dirty × total) in the worst case, but in practice overlapping elements are rare (mostly dialogs), and dialogs are usually on top (higher z-index) so case 1 applies.

**Optimisation:** Track z-index order. Only check for overlap with higher-z elements.

### CSS variable invalidation

When a CSS variable changes (node's class changes and a matching rule sets `--color: newvalue`):

1. During style-resolve, compare the node's resolved variables with the cached variables
2. If any variable changed, mark all descendants for style-resolve (variables inherit)
3. This is conservative but correct — a future optimisation could track which descendants actually use `var(--color)`

### Interaction with buffer diffing

The buffer diff is already incremental — it compares cell-by-cell and only outputs changes. The incremental rendering pipeline feeds into this naturally:

- Paint-only path: writes fewer cells to the buffer → fewer diffs
- Layout-local path: only the affected subtree's cells change → fewer diffs
- The diff step itself is unchanged

### Performance expectations

| Scenario | Current | With incremental |
|---|---|---|
| Text content change (same length) | O(n) full recompute | O(1) paint-only |
| Text content change (length changes, fixed container) | O(n) | O(1) paint-only |
| Text content change (length changes, auto container) | O(n) | O(path to fixed ancestor) |
| Class change (style only) | O(n) | O(subtree) for style + O(affected) for paint |
| Node insert (fixed parent) | O(n) | O(parent's children) |
| Node insert (auto parent) | O(n) | O(path to fixed ancestor + siblings) |
| Terminal resize | O(n) | O(n) — unchanged, correct |
| Focus change | O(n) | O(1) style + paint for 2 nodes |
| Scroll | O(n) | O(visible cells in scroll container) |

### What we're NOT doing

- **Signal-level dependency tracking between Svelte state and render cache.** Svelte's effect system already handles this. We react to the renderer method calls, not to the signals directly.
- **Virtual DOM diffing.** We don't have a virtual DOM. We have a real node tree that Svelte mutates directly via the renderer interface.
- **Async rendering / concurrent mode.** All rendering is synchronous within a microtask. This is simpler and correct for terminal output.

## Implementation Plan

### Step 1: Add RenderCache to TermNode
- `resolvedStyle`, `layoutBox`, `contentSize` fields
- No behaviour change — just storage

### Step 2: Persist style and layout maps across renders
- Currently created fresh each render
- Instead, store on the mount context, reuse between renders
- Full recompute still works (populate everything fresh on first render)

### Step 3: Add RenderQueue
- Queue structure with the four categories
- `mount()` creates the queue, renderer methods enqueue work
- After microtask, process queue then clear

### Step 4: Route renderer methods through queue
- `setText` → determine path → enqueue
- `setAttribute` → determine path → enqueue
- `insert`/`remove` → determine path → enqueue
- Replace the monkey-patched `insertBefore` with proper queue integration

### Step 5: Incremental style resolution
- Process `styleResolve` queue items
- Compare new style to cached, skip if unchanged
- Detect layout-affecting changes → promote to layout queue

### Step 6: Incremental layout
- Process `layoutSubtree` and `layoutBubble` queue items
- `findLayoutBoundary` for bubble path
- Compare new layout box to cached, detect paint-dirty

### Step 7: Incremental paint
- Process `paintOnly` queue items
- Only write changed nodes' cells to buffer
- Handle overlap detection for z-indexed elements

### Step 8: Tests
- Verify incremental output matches full recompute for every mutation type
- Performance benchmarks: large tree, single mutation, measure work done
- Regression tests: ensure no visual artifacts from stale cache

Each step is independently testable and committable. Steps 1-3 are infrastructure with no behaviour change. Steps 4-7 are the incremental behaviour. Step 8 validates correctness.
