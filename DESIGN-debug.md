# Svelterm Debug Protocol (SDP)

A CDP-inspired debug protocol for svelterm applications. Enables runtime inspection, live editing, and developer tooling.

## Overview

```
┌─────────────────────────┐          ┌──────────────────────┐
│  svelterm app           │          │  debug client         │
│  (debug: true)          │          │                      │
│                         │ WebSocket│  CLI tool             │
│  ┌─────────────────┐    │◄────────►│  $ svt tree          │
│  │  DebugServer     │    │          │  $ svt styles 42     │
│  │  :9200           │    │          │  $ svt highlight 42  │
│  └─────────────────┘    │          │                      │
│                         │          │  OR                   │
│  ┌─────────────────┐    │          │                      │
│  │  App component   │    │          │  DevTools TUI         │
│  │  (renders to     │    │          │  (built with svelterm)│
│  │   terminal)      │    │          │  Tree │ Styles │ Layout│
│  └─────────────────┘    │          └──────────────────────┘
└─────────────────────────┘
```

## Protocol

WebSocket on configurable port (default 9200). JSON messages following CDP conventions:

### Message Format

**Request** (client → server):
```json
{ "id": 1, "method": "DOM.getDocument", "params": {} }
```

**Response** (server → client):
```json
{ "id": 1, "result": { "root": { ... } } }
```

**Event** (server → client, no id):
```json
{ "method": "DOM.childNodeInserted", "params": { "parentNodeId": 4, "node": { ... } } }
```

## Domains

### DOM

Inspect the virtual node tree.

| Method | Params | Returns | Description |
|---|---|---|---|
| `DOM.getDocument` | — | `{ root: Node }` | Full tree snapshot |
| `DOM.getNode` | `{ nodeId }` | `{ node: Node }` | Single node with children |
| `DOM.getAttributes` | `{ nodeId }` | `{ attributes: [k, v, ...] }` | Node attributes |
| `DOM.querySelector` | `{ nodeId, selector }` | `{ nodeId }` | Find by CSS selector |
| `DOM.querySelectorAll` | `{ nodeId, selector }` | `{ nodeIds: [] }` | Find all by selector |
| `DOM.getOuterHTML` | `{ nodeId }` | `{ outerHTML }` | Serialised subtree |
| `DOM.setAttributeValue` | `{ nodeId, name, value }` | — | Live edit attribute |
| `DOM.removeAttribute` | `{ nodeId, name }` | — | Remove attribute |

**Events:**
- `DOM.childNodeInserted` — `{ parentNodeId, previousNodeId, node }`
- `DOM.childNodeRemoved` — `{ parentNodeId, nodeId }`
- `DOM.attributeModified` — `{ nodeId, name, value }`
- `DOM.characterDataModified` — `{ nodeId, characterData }`

**Node format:**
```json
{
  "nodeId": 42,
  "nodeType": "element",
  "tag": "div",
  "attributes": ["class", "app svelte-abc", "data-focused", "true"],
  "children": [...],
  "text": null
}
```

### CSS

Inspect resolved styles and matched rules.

| Method | Params | Returns | Description |
|---|---|---|---|
| `CSS.getComputedStyle` | `{ nodeId }` | `{ computedStyle: [...] }` | Resolved style properties |
| `CSS.getMatchedStyles` | `{ nodeId }` | `{ matched: [...] }` | Rules that matched this node |
| `CSS.getStylesheet` | — | `{ rules: [...] }` | The active stylesheet |
| `CSS.setProperty` | `{ nodeId, property, value }` | — | Live edit a style |

**computedStyle format:**
```json
[
  { "name": "color", "value": "cyan" },
  { "name": "display", "value": "flex" },
  { "name": "width", "value": "40" }
]
```

### Layout

Inspect layout boxes.

| Method | Params | Returns | Description |
|---|---|---|---|
| `Layout.getBoxModel` | `{ nodeId }` | `{ box: { x, y, width, height } }` | Layout box |
| `Layout.getTree` | — | `{ boxes: [...] }` | All layout boxes |

### Overlay

Visual debugging aids.

| Method | Params | Returns | Description |
|---|---|---|---|
| `Overlay.highlightNode` | `{ nodeId, color? }` | — | Draw border around node's box |
| `Overlay.hideHighlight` | — | — | Remove highlight |
| `Overlay.inspectMode` | `{ enabled }` | — | Hover highlights nodes, click selects |

### Render

Render pipeline inspection.

| Method | Params | Returns | Description |
|---|---|---|---|
| `Render.getQueue` | — | `{ queue: { paintOnly, styleResolve, ... } }` | Current render queue |
| `Render.getBuffer` | — | `{ width, height, cells: [...] }` | Current cell buffer |
| `Render.getPerformance` | — | `{ lastRender: { styleMs, layoutMs, paintMs, diffMs } }` | Timing |
| `Render.forceRepaint` | — | — | Trigger full repaint |

### Input

Monitor and simulate input events.

| Method | Params | Returns | Description |
|---|---|---|---|
| `Input.getFocus` | — | `{ nodeId }` | Currently focused node |
| `Input.dispatchKeyEvent` | `{ key, ctrl?, shift?, meta? }` | — | Simulate keypress |
| `Input.dispatchMouseEvent` | `{ type, button, col, row }` | — | Simulate mouse |

**Events:**
- `Input.keyDown` — `{ key, ctrl, shift, meta, targetNodeId }`
- `Input.mouseEvent` — `{ type, button, col, row, targetNodeId }`
- `Input.focusChanged` — `{ nodeId, previousNodeId }`

### Runtime

Application-level inspection.

| Method | Params | Returns | Description |
|---|---|---|---|
| `Runtime.getInfo` | — | `{ colorScheme, terminalSize, scrollPositions }` | Runtime state |

## Implementation Plan

### Phase 1: Debug Server + DOM domain

Embed a WebSocket server in svelterm when `debug: true` is passed to `mount()`. Implement `DOM.getDocument`, `DOM.getNode`, `DOM.getAttributes`.

Wire mutation hooks (insert, remove, setText, setAttribute) to emit DOM events to connected clients.

### Phase 2: CLI client (`svt`)

TypeScript CLI tool:
```bash
svt tree                    # print node tree
svt tree --depth 3          # limit depth
svt node 42                 # inspect single node
svt styles 42               # show computed styles
svt layout 42               # show box model
svt highlight 42             # highlight on screen
svt attrs 42                # show attributes
```

Connects to WebSocket, sends one request, prints result, exits. Like hubcap's individual commands.

### Phase 3: CSS + Layout domains

Add `CSS.getComputedStyle`, `CSS.getMatchedStyles`, `Layout.getBoxModel`. These read from the existing `lastStyles` and `lastLayout` maps.

### Phase 4: Overlay domain

Implement `Overlay.highlightNode` — renders a coloured border overlay around the target node's layout box without affecting actual layout. `inspectMode` highlights on hover and reports the node id.

### Phase 5: DevTools TUI

A svelterm application that connects to another svelterm app's debug server:

```
┌─ Elements ─────────────────────────────────────────┐
│ ▼ <div.app>                    │ Styles             │
│   ▼ <div.header>               │ display: flex      │
│     <span.title> "Svelterm"    │ flex-direction: col │
│   ▼ <div.panels>               │ gap: 1cell         │
│     ► <div.panel>              │ padding: 1cell 2cell│
│     ► <div.panel>              │                     │
│   <span.hint> "Tab to..."     │ Layout              │
│                                │ x:0 y:0 w:80 h:24  │
│                                │                     │
├─ Console ──────────────────────┤                     │
│ [info] Render: 2.1ms          │                     │
│ [info] Style resolve: 0.4ms   │                     │
│ > _                           │                     │
└────────────────────────────────┴─────────────────────┘
```

Built with svelterm itself — tree view, style inspector, layout visualisation, console. Connects to the target app's debug server via WebSocket. This is the terminal equivalent of Chrome DevTools.

### Phase 6: Render + Performance domains

Timing hooks around style resolution, layout, paint, and diff. Exposed via `Render.getPerformance`. The DevTools TUI shows a performance panel with render timings.

## Connection

```typescript
// In the app being debugged
mount(App, { debug: true, debugPort: 9200 })

// CLI
$ svt tree --port 9200

// DevTools TUI
$ svt inspect --port 9200
```

## Design Principles

1. **Zero cost when disabled** — no overhead when `debug` is not set
2. **Non-intrusive** — debug server observes, doesn't modify (except Overlay highlights)
3. **CDP-compatible conventions** — familiar to anyone who's used Chrome DevTools protocol
4. **Self-hosted tooling** — the DevTools TUI is built with svelterm, dogfooding the framework
