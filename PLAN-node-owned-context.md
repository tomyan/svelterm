# Plan: Move RenderContext from renderer to node tree

## Goal

Eliminate the need for two renderer instances by moving mutation tracking
from the renderer closure into the node tree. This makes the renderer
stateless, aligns with Svelte's intended custom renderer API (one
renderer, one static import), and removes the need for the upstream
`push_renderer_if_inactive` PR.

## Current design

- `createTermRenderer(ctx?)` creates a renderer with an optional
  `RenderContext` captured in closures
- `renderer/default.ts` exports a bare instance (no ctx) for the compiler
- `mount()` creates a second instance with ctx for `renderer.render()`
- Effects can capture the wrong instance, requiring the upstream Svelte
  fix

## Target design

- `createTermRenderer()` takes no arguments — stateless
- Renderer methods read `node.ctx` to find the `RenderContext`
- `mount()` sets `root.ctx = new RenderContext()` on the root node
- `insertBefore()` propagates `ctx` to inserted nodes
- `remove()` / `removeChild()` clears `ctx` on removed nodes
- The static import IS the renderer used everywhere — one instance

## Slices

### Slice 1: Add `ctx` property to TermNode with propagation

Add `ctx: RenderContext | null` to `TermNode`. Propagate on insert, clear
on remove.

- Add `ctx` property (default null)
- In `insertBefore()`, after inserting, propagate `this.ctx` to the
  inserted node and all its descendants
- In `removeChild()`, clear ctx on the removed node and descendants
- In `cleanup()`, clear ctx
- Extract a `propagateCtx` helper for setting ctx recursively
- Tests: verify ctx propagates on insert, clears on remove, propagates
  through fragment expansion, handles re-parenting

### Slice 2: Make renderer read ctx from nodes instead of closure

Change `createTermRenderer()` to take no arguments. Each renderer method
that currently branches on `if (ctx)` instead reads `node.ctx`.

- `setText(node, text)` → use `node.ctx?.onSetText(node, text)` or
  fall back to direct mutation
- `setAttribute(el, key, value)` → use `el.ctx?.onSetAttribute(...)`
- `removeAttribute(el, key)` → use `el.ctx?.onRemoveAttribute(...)`
- `insert(parent, node, anchor)` → after `insertBefore`, call
  `parent.ctx?.onInsert(parent, node)`
- `remove(node)` → capture parent before removal, call
  `parent?.ctx?.onRemove(node, parent)` (note: ctx must be read BEFORE
  clearing it in removeChild)
- `createTextNode(data)` — remove the `onMutate` setup (no longer
  needed here; ctx handles it)
- Remove `ctx` parameter from `createTermRenderer`
- Update `renderer/default.ts` (trivial — already calls with no args)
- Update existing renderer tests

### Slice 3: Simplify mount() to use static import

- Remove `const renderer = createTermRenderer(ctx)` from mount()
- Import the default renderer instead
- Set `root.ctx = ctx` before calling `renderer.render()`
- Remove or simplify `registerMutationCallbacks` — text node `onMutate`
  is now handled through ctx propagation, not manual registration
- Verify all demos still work

### Slice 4: Handle onMutate / nodeValue fallback

TermNode's `nodeValue` setter calls `this.onMutate?.()` for DOM compat
(Svelte effects may set nodeValue directly). With ctx on the node, this
should go through ctx instead:

- Change `nodeValue` setter to call through `this.ctx` if available
- Same for `textContent` setter
- Remove `onMutate` property if no longer needed, or keep it as a
  secondary hook if mount() still uses it for anything
- Update `registerMutationCallbacks` in index.ts accordingly

### Slice 5: Close the upstream PR

- Revert the `push_renderer_if_inactive` commit from the svelte fork
  (the fork has many other custom renderer changes, so we can't switch
  to stock Svelte yet)
- Close PR sveltejs/svelte#18058 with a comment explaining the
  resolution — we no longer need the upstream change because
  RenderContext now lives on the node tree, eliminating the two-renderer
  pattern
