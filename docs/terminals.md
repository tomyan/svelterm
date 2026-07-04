# Terminal support

svelterm adapts its output to the terminal it lands in. Detection runs in
the background at startup; the first frame paints with today's most common
defaults (truecolor, synchronized output) and re-paints if the terminal
turns out to be older.

## Colour depth

Hex/RGB colours quantize at emit time to what the terminal can show:

| Depth | Emitted as | Chosen when |
|---|---|---|
| `truecolor` | `38;2;r;g;b` | `COLORTERM=truecolor`/`24bit`, or a known-truecolor terminal answers XTVERSION (iTerm2, kitty, WezTerm, Ghostty, Alacritty, Contour, Rio, VS Code) |
| `256` | `38;5;n` — nearest xterm cube/grey-ramp entry | `TERM` contains `256color` |
| `16` | nearest base colour's SGR code | everything else |
| `mono` | no colour output | [`NO_COLOR`](https://no-color.org/) is set |

ANSI colour names (`red`, `cyan`, …) pass through unchanged at every depth
— they always mean "the terminal's palette colour".

Override detection with `run(App, { colorDepth: '256' })`.

## Synchronized output

Frames are wrapped in DEC 2026 begin/end-synchronized-update so terminals
that support it repaint atomically (no tearing on large updates). Support
is probed with `DECRQM`; terminals that don't answer get plain writes.

## Colour scheme

`prefers-color-scheme` resolves from an OSC 11 background query, polled so
a live theme switch re-renders the app. Pin it with
`run(App, { colorScheme: 'light' })` (embedded terminals do this — the
OSC channel is meaningless there).

## Text selection and clipboard

Mouse reporting turns off the terminal's native selection, so svelterm
provides its own: **drag** selects a cell range (painted inverted),
**double-click** selects the word, **triple-click** the line. Releasing
the button copies the selection — via OSC 52 (survives ssh; needs the
terminal to allow clipboard writes) and the platform tool (`pbcopy`,
`wl-copy`/`xclip`, `clip`) when one exists. The highlight clears on the
next click.

## Cursor shape

The real terminal cursor becomes a **bar** while a focused
`<input>`/`<textarea>` owns it (DECSCUSR), and resets to the terminal's
configured shape otherwise — including on exit.

## Queries a svelterm app may send

At startup: OSC 11 (background colour), `CSI > 0 q` (XTVERSION, only when
the environment didn't already decide colour depth), `CSI ? 2026 $ p`
(DECRQM for synchronized output). All race a short timeout, so a terminal
that answers none of them just gets the conservative defaults.
