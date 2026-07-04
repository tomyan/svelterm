# DevTools

`svelterm devtools` is a terminal DevTools — itself a svelterm app — that
connects to a running app's debug server and inspects its live tree,
computed styles, and layout.

## Use

Run the app you want to inspect with `debug: true`:

```ts
run(App, { css, debug: true })   // debug server on 127.0.0.1:9444
```

Then, in another terminal (or tmux pane):

```bash
svelterm devtools               # connect on 9444
svelterm devtools --port 9500   # a non-default port
```

- **Left pane** — the node tree, indented by depth, each row labelled
  `<div#id.class>` / `"text"` / `<!--comment-->`.
- **Right pane** — the selected node's computed style (the values
  svelterm actually painted) and its layout box.
- **↑ / ↓** move the selection, **r** refreshes the tree, **Ctrl+C**
  quits.

It talks the same JSON protocol as the [`svt`](./svt.md) one-shot client
(the `DOM` and `CSS` domains), so it works against any app that opens a
debug server — including one running over ssh, if you forward the port.

## Note

Like the debug server itself, DevTools needs a real `ws` — it inspects
apps run from source or via `svelterm dev`, not `svelterm build` bundles
(which stub `ws` out).
