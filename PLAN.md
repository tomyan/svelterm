# Svelterm — Comprehensive Plan

Consolidated from `todo`, sumi `wishlist.md`, and current implementation status.
Organised into phases by dependency order and value delivery.

Legend: ✅ implemented, 🔧 partial, ❌ not started

---

## Phase 1: Fix What's Broken

Things that should work but don't, discovered through demos and testing.

1. **Arrow key handling in demos** ❌
   - Snake demo arrow keys don't trigger — verify keydown dispatch reaches components
   - Test: send arrow key buffer, assert event fires on focused element

2. **Mouse click on buttons** ❌
   - Demos should be clickable as well as keyboard-controllable
   - Mouse mode needs enabling in demos (`mouse: true` option)
   - Test: hit-test + dispatchEvent for mouse press on button

3. **Ctrl+Z suspend, Ctrl+D EOF** ❌
   - Ctrl+Z should SIGTSTP (suspend to background)
   - Ctrl+D should be configurable (EOF / exit)
   - Wire into input handler alongside Ctrl+C

---

## Phase 2: Core CSS & Layout Completeness

Properties needed for real applications. Most have partial or no support.

4. **flex-basis** ❌
   - Flex shorthand already parses grow/shrink but ignores basis
   - Basis should set the initial main size before grow/shrink

5. **display: contents** ❌
   - Element is invisible to layout, children promoted to grandparent's layout context
   - Useful for wrapper components that shouldn't affect layout

6. **display: inline-block widths** 🔧
   - Verify inline-block elements respect explicit width/height

7. **Percentage heights** 🔧
   - `height: 50%` should resolve against parent's height
   - Currently only width percentages are resolved

8. **256-color palette** ❌
   - Support `color-196` or equivalent syntax
   - Map to xterm 256-color codes in ANSI output

9. **Truecolor passthrough** 🔧
   - Currently maps hex to nearest ANSI — should pass through as 24-bit when terminal supports it
   - Already partially working (ansi.ts has truecolor output)
   - Need to stop the nearest-ANSI mapping in color.ts

---

## Phase 3: Input & Interaction

10. **Verify arrow key / special key dispatch** ❌
    - Arrow keys parsed in keyboard.ts but may not reach component event handlers
    - keydown events need to dispatch with correct key data

11. **Mouse wheel scrolling** ❌
    - Scroll events parsed but need to connect to overflow:scroll containers
    - Shift+scroll for horizontal scrolling

12. **:hover pseudo-class** ❌
    - Mouse motion tracking (DEC 1003 mode)
    - Set/clear `data-hovered` attribute on mouse enter/leave
    - Trigger style re-resolve like :focus

13. **Bracketed paste** ❌
    - Detect `\x1b[200~` ... `\x1b[201~` sequences
    - Deliver as single paste event rather than individual keystrokes

14. **Kitty keyboard protocol** ❌
    - CSI u sequences for unambiguous modifier detection
    - Probe terminal capability, fall back to standard

15. **Priority-based key routing** ❌
    - Multiple handlers with priority levels
    - Modal dialogs should capture keys before background

---

## Phase 4: Rendering Quality

16. **Synchronized output (DEC 2026)** ❌
    - Wrap frame output in BSU/ESU to prevent tearing
    - Probe terminal support via DECRQM

17. **Virtual scrolling** ❌
    - Only render/layout visible children in scroll containers
    - Essential for large lists (1000+ items)

18. **Terminal capability detection** ❌
    - Probe at startup: DA1/DA2, XTVERSION, DECRQM
    - Detect color depth, keyboard protocol, mouse support, sync output
    - Terminal identification (iTerm2, Ghostty, Kitty, VS Code, etc.)

19. **Color degradation** 🔧
    - Truecolor → 256 → 16 fallback based on detected capability
    - Perceptual color quantization (not just nearest match)

20. **Adaptive colors (light/dark)** 🔧
    - OSC 11 background color query for runtime detection
    - Poll on focus / every N seconds
    - Currently have @media (prefers-color-scheme) but no runtime detection

21. **DECSTBM hardware scroll regions** ❌
    - Efficient partial-screen scrolling for scroll containers
    - Avoid full repaint when only scroll position changes

---

## Phase 5: Text & Content

22. **Raw ANSI passthrough element** ❌
    - `<pre data-ansi>` or similar for externally-styled content
    - Pass pre-formatted ANSI strings directly to buffer without processing
    - Critical for syntax-highlighted code, command output embedding

23. **Content-editable / text input** 🔧
    - TextBuffer exists but needs integration with `<input>` and `<textarea>` elements
    - Readline-compatible editing (Ctrl+A/E/U/K/W)
    - Cursor rendering within input fields

24. **Syntax highlighting** ❌
    - Tree-sitter integration for code blocks
    - Map tree-sitter scopes to theme colors
    - Proven approach from hubcap project

25. **Markdown rendering** ❌
    - Component or utility for rendering styled markdown
    - Headings, bold/italic, lists, tables, links, code blocks
    - Code blocks with syntax highlighting via tree-sitter

26. **Middle truncation** ❌
    - `text-overflow: ellipsis-middle` or similar
    - Show start and end of text with ellipsis in middle
    - Common for file paths

27. **word-break control** ❌
    - `word-break: break-all` for CJK-aware line breaking
    - `overflow-wrap: break-word`

---

## Phase 6: Component Library

Separate package (`@svelterm/ui` or similar) built on the renderer.

28. **Dialog / modal overlay** ❌
    - Z-layered, dismissible, captures focus and keys
    - Dim/shadow backdrop effect

29. **Selectable list** ❌
    - Keyboard-navigable list with selection highlighting
    - Used in pickers, menus, file browsers

30. **Tabs** ❌
    - Switchable tab bar with content panels
    - Keyboard navigation between tabs

31. **Progress bar** ❌
    - Determinate (percentage) and indeterminate (spinner) variants
    - Block-fill character rendering

32. **Fuzzy picker** ❌
    - Filterable searchable list (like fzf)
    - Incremental matching with highlighting

33. **Toast / notification** ❌
    - Transient message overlay
    - Auto-dismiss after timeout

34. **Diff renderer** ❌
    - Unified diff with line numbers
    - Tree-sitter highlighting for code
    - Add/remove coloring

35. **File browser** ❌
    - Directory tree navigation
    - Preview pane
    - Already have a demo skeleton

36. **Table component** ❌
    - Styled rows/columns with selection
    - Column resizing, sorting indicators

37. **Gradient text** ❌
    - Multi-color text spans
    - HSL interpolation across character positions

---

## Phase 7: Terminal Features

38. **Cursor shape control** ❌
    - DECSCUSR: block, underline, bar
    - Blinking vs static variants
    - Set cursor shape for input fields

39. **Clipboard** ❌
    - OSC 52 write with platform fallbacks (pbcopy, wl-copy, tmux)
    - Clipboard read where supported

40. **Text selection** ❌
    - Mouse drag-to-select
    - Word (double-click) and line (triple-click) selection
    - Copy to clipboard on selection complete

41. **Image rendering** ❌
    - Half-block (`▀▄`) with truecolor fg/bg
    - Sixel or Kitty graphics protocol where supported
    - Fallback to alt text

42. **Inline rendering mode** ❌
    - Non-alt-screen rendering within terminal scrollback
    - For CLI tools that output styled content inline

43. **Color blending / alpha compositing** ❌
    - Semi-transparent overlays
    - Background blending for modal backdrops

---

## Phase 8: Developer Experience

44. **Vite plugin** ❌
    - Proper `vite-plugin-svelterm` package
    - Auto-sets customRenderer, css: external
    - Dev mode with HMR
    - Currently manual vite.config.ts

45. **Dev mode with live reload** ❌
    - `npx svelterm dev` — terminal preview with HMR
    - Style-only changes: hot swap CSS, preserve state
    - Template changes: re-mount, preserve state

46. **VT100 component for web** ❌
    - Terminal emulator component for website
    - Run demos client-side in browser
    - Coding font, proper escape sequence interpretation

47. **Dual rendering demo** ❌
    - Single component rendering in both terminal and browser
    - Side-by-side comparison
    - @media (display-mode: terminal/screen) switching

---

## Phase 9: Documentation & Community

48. **Repository documentation** ❌
    - API reference
    - Getting started guide
    - CSS property reference (what's supported, terminal-specific values)
    - Publishing to doc site (svelterm.dev?)

49. **Blog post** ❌
    - Architecture deep-dive
    - "Why CSS for terminals"
    - Comparison with Ink, Bubble Tea, Ratatui

50. **Engage on Svelte PR** ❌
    - PR #18058 (push_renderer_if_inactive)
    - Follow up on custom renderer API stabilisation

---

## Phase 10: Advanced / Research

51. **Multi-screen switching (Kit-style)** ❌
    - Multiple full-screen views with switching
    - Like tmux panes but within the app

52. **Headless component API** ❌
    - Unstyled component primitives (logic only)
    - Consumers provide their own styling
    - Could be shared across Gemini CLI, Claude Code, etc.

53. **Embedded VT100 component** ❌
    - Terminal-within-terminal
    - For running subprocesses with their own rendering

54. **Vim mode support** ❌
    - Normal/insert mode with separate key handling
    - $EDITOR integration for external editor launch

55. **Screen reader / accessibility mode** ❌
    - Alternative layout/output for assistive technology
    - Semantic structure over visual

56. **Animations** 🔧
    - @keyframes parsing + AnimationRunner exist
    - Shared animation clock (setInterval/setTimeout coordination)
    - requestAnimationFrame equivalent for terminal
    - Shimmer / sweep effects

57. **BiDi / RTL text** ❌
    - Right-to-left text reordering
    - Mixed BiDi content

---

## Demo Backlog

Demos to build that exercise and showcase features:

- ✅ Counter — CSS variables, focus, events
- ✅ Dashboard — real-time updates, flex, borders
- ✅ Todo — focus management, list rendering, class toggling
- ✅ Showcase — all colors, text styles, borders, alignment
- ✅ Keyboard Hero — game loop, keyboard input, scoring
- ✅ Snake — rapid updates, arrow keys, collision
- ❌ Dark/Light theming demo — runtime theme switching, OSC 11 detection
- ❌ Color palette demo — 16, 256, 24-bit side by side
- ❌ svmux demo — multi-pane terminal multiplexer
- ❌ Sveditor demo — content-editable with syntax highlighting
- ❌ File browser — scrolling, mouse, tree navigation
- ❌ Markdown viewer — styled markdown rendering
- ❌ Regular Svelte demos — components that also work in browser
- ❌ Dual-target demo — same component in terminal and web side by side
