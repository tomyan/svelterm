# CSS Color Support Design

## Current State

`src/css/color.ts` currently supports:
- Hex: `#rgb`, `#rrggbb`
- `rgb(r, g, b)` — legacy comma syntax only
- `hsl(h, s%, l%)` — legacy comma syntax only
- Named colours — all 148 CSS named colours
- ANSI colour names (terminal-specific: `cyan`, `red`, etc.)

## What's Missing

### Modern Syntax (CSS Color Level 4)

All colour functions now accept **space-separated** values with optional **`/ alpha`**:

```css
rgb(72 202 228)
rgb(72 202 228 / 0.5)
hsl(150 30% 60%)
hsl(150 30% 60% / 80%)
```

The legacy comma syntax is still valid for rgb() and hsl() only. All newer functions use space-only syntax.

### New Functions

| Function | Parameters | Priority |
|----------|-----------|----------|
| `hwb(H W B / A)` | hue 0-360, whiteness 0-100%, blackness 0-100% | Medium |
| `lab(L a b / A)` | lightness 0-100, a -125..125, b -125..125 | Medium |
| `lch(L C H / A)` | lightness 0-100, chroma 0-150, hue 0-360 | Medium |
| `oklab(L a b / A)` | lightness 0-1, a -0.4..0.4, b -0.4..0.4 | High |
| `oklch(L C H / A)` | lightness 0-1, chroma 0-0.4, hue 0-360 | High |
| `color(space R G B / A)` | space-dependent, values 0-1 | Low |

### Hex with Alpha

```css
#rrggbbaa
#rgba
```

### Special Values

- `transparent` — `rgba(0, 0, 0, 0)`
- `currentColor` — inherited text colour (already handled at style level)

## Conversion Pipeline

All colour functions ultimately need to produce a terminal colour, which is either:
- A named ANSI colour (for 16-colour terminals)
- A hex `#rrggbb` (for truecolor terminals)

The conversion chain:

```
oklch → oklab → linear-sRGB → sRGB → #rrggbb
lch   → lab   → XYZ-D50     → linear-sRGB → sRGB → #rrggbb
hwb   → sRGB  → #rrggbb
hsl   → sRGB  → #rrggbb (existing)
rgb   → sRGB  → #rrggbb (existing)
```

### OKLCH/OKLAB → sRGB

OKLCH to OKLAB (cylindrical to rectangular):
```
a = C * cos(H * pi/180)
b = C * sin(H * pi/180)
```

OKLAB to linear sRGB via LMS intermediate:
```
// Oklab → LMS (inverse of M2 matrix, then cube)
l = (L + 0.3963377774*a + 0.2158037573*b)^3
m = (L - 0.1055613458*a - 0.0638541728*b)^3
s = (L - 0.0894841775*a - 1.2914855480*b)^3

// LMS → linear sRGB (inverse of M1)
R =  4.0767416621*l - 3.3077363322*m + 0.2309101289*s
G = -1.2684380046*l + 2.6097574011*m - 0.3413193761*s
B = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
```

Linear sRGB → sRGB (gamma):
```
if v <= 0.0031308: v * 12.92
else: 1.055 * v^(1/2.4) - 0.055
```

Clamp to 0-1 then scale to 0-255.

### LAB/LCH → sRGB

LCH to LAB (same cylindrical → rectangular as OKLCH):
```
a = C * cos(H * pi/180)
b = C * sin(H * pi/180)
```

LAB to XYZ-D50:
```
fy = (L + 16) / 116
fx = a / 500 + fy
fz = fy - b / 200

// Inverse of f(t):
X = (fx > 6/29) ? fx^3 : (116*fx - 16) / 903.3  * D50_X
Y = (L > 8) ? ((L+16)/116)^3 : L / 903.3         * D50_Y
Z = (fz > 6/29) ? fz^3 : (116*fz - 16) / 903.3  * D50_Z
```

D50 white point: X=0.3457/0.3585, Y=1.0, Z=(1-0.3457-0.3585)/0.3585

XYZ-D50 → XYZ-D65 via Bradford chromatic adaptation matrix, then XYZ-D65 → linear sRGB → sRGB.

### HWB → sRGB

```
// Normalise when w + b > 100%
if (w + b > 100) { w = w/(w+b)*100; b = b/(w+b)*100 }

// Convert via HSL
// First get the pure hue colour from H
rgb = hueToRgb(H)  // same as hsl(H, 100%, 50%)

// Mix with white and black
r = rgb.r * (1 - w/100 - b/100) + w/100 * 255
g = rgb.g * (1 - w/100 - b/100) + w/100 * 255
b = rgb.b * (1 - w/100 - b/100) + b/100 * 255
```

## Parsing

The parser needs to handle:

1. **Function detection**: `rgb(`, `hsl(`, `hwb(`, `lab(`, `lch(`, `oklab(`, `oklch(`, `color(`
2. **Value parsing**: numbers, percentages, `none`, `/ alpha`
3. **Angle units**: `deg` (default), `rad`, `grad`, `turn` for hue values
4. **Percentage or number**: each parameter can be either

A unified parser approach:

```typescript
function parseColorFunction(input: string): Color | null {
    const match = input.match(/^(\w+)\((.+)\)$/)
    if (!match) return null
    const [, name, args] = match

    // Split on spaces, handling / for alpha
    const parts = args.trim().split(/\s+/)
    const slashIdx = parts.indexOf('/')
    const channels = slashIdx >= 0 ? parts.slice(0, slashIdx) : parts
    const alpha = slashIdx >= 0 ? parseAlpha(parts[slashIdx + 1]) : 1

    switch (name) {
        case 'rgb': case 'rgba': return parseRgb(channels, alpha)
        case 'hsl': case 'hsla': return parseHsl(channels, alpha)
        case 'hwb': return parseHwb(channels, alpha)
        case 'lab': return parseLab(channels, alpha)
        case 'lch': return parseLch(channels, alpha)
        case 'oklab': return parseOklab(channels, alpha)
        case 'oklch': return parseOklch(channels, alpha)
        case 'color': return parseColorSpace(channels, alpha)
        default: return null
    }
}
```

Legacy comma syntax for rgb/hsl detected by presence of commas.

## Alpha Handling

Terminal rendering doesn't support true alpha compositing — there's no "behind" to blend with. Options:

1. **Ignore alpha** — treat all colours as opaque (simplest)
2. **Blend with background** — premultiply against the element's or terminal's background colour
3. **Store alpha separately** — for use in the `opacity` CSS property which svelterm maps to the terminal `dim` attribute

For the colour parser, store alpha in the resolved colour string. The renderer can decide how to handle it. Hex output: `#rrggbbaa` when alpha < 1, `#rrggbb` when opaque.

## Implementation Plan

### Phase 1: Modern syntax + hex alpha
- Update rgb()/hsl() parsers to accept space-separated + `/ alpha`
- Support `#rrggbbaa` and `#rgba`
- Support `transparent` keyword
- Support angle units (deg/rad/grad/turn) for hue values

### Phase 2: OKLCH + OKLAB
- Implement OKLAB → linear sRGB → sRGB conversion
- Implement OKLCH → OKLAB (cylindrical → rectangular)
- Parse `oklch()` and `oklab()` functions
- Gamut mapping: clamp out-of-sRGB values

### Phase 3: HWB + LAB/LCH
- Implement HWB → sRGB conversion
- Implement LAB → XYZ → sRGB conversion chain
- Implement LCH → LAB
- Parse `hwb()`, `lab()`, `lch()` functions

### Phase 4: color() function
- Parse `color(srgb ...)`, `color(display-p3 ...)` etc.
- Convert to sRGB (clamp wide-gamut values)

## Testing

Each conversion should be tested against known reference values. Sources:
- W3C CSS Color test suite
- Color.js library reference values
- Browser-computed values (render in browser, read back)

Key test cases per function:
- Pure primaries (red, green, blue)
- White, black, mid-grey
- Known named colours (verify round-trip)
- Edge cases: out-of-gamut OKLCH values, negative lab components
- Alpha variations
