/**
 * Colour quantization for terminals without truecolor: hex → the xterm
 * 256-colour palette, or the nearest of the 16 base colours.
 */

/** Nominal xterm RGB values for the 16 SGR names. */
const BASE16: Array<{ name: string; rgb: [number, number, number] }> = [
    { name: 'black', rgb: [0, 0, 0] },
    { name: 'red', rgb: [205, 0, 0] },
    { name: 'green', rgb: [0, 205, 0] },
    { name: 'yellow', rgb: [205, 205, 0] },
    { name: 'blue', rgb: [0, 0, 238] },
    { name: 'magenta', rgb: [205, 0, 205] },
    { name: 'cyan', rgb: [0, 205, 205] },
    { name: 'white', rgb: [229, 229, 229] },
]

function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ]
}

/** The 0–5 colour-cube step nearest a channel value, per xterm's levels. */
const CUBE_LEVELS = [0, 95, 135, 175, 215, 255]

function nearestCubeStep(value: number): number {
    let best = 0
    for (let i = 1; i < CUBE_LEVELS.length; i++) {
        if (Math.abs(CUBE_LEVELS[i] - value) < Math.abs(CUBE_LEVELS[best] - value)) best = i
    }
    return best
}

function distance(a: [number, number, number], b: [number, number, number]): number {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

/** Map #rrggbb to the nearest xterm 256-palette index (cube or grey ramp). */
export function quantizeTo256(hex: string): number {
    const rgb = hexToRgb(hex)
    const [r, g, b] = rgb

    const steps = [nearestCubeStep(r), nearestCubeStep(g), nearestCubeStep(b)]
    const cubeIndex = 16 + 36 * steps[0] + 6 * steps[1] + steps[2]
    const cubeRgb: [number, number, number] =
        [CUBE_LEVELS[steps[0]], CUBE_LEVELS[steps[1]], CUBE_LEVELS[steps[2]]]

    // Grey ramp: 232–255 covering 8..238 in steps of 10
    const grey = Math.round((r + g + b) / 3)
    const greyStep = Math.min(23, Math.max(0, Math.round((grey - 8) / 10)))
    const greyValue = 8 + greyStep * 10
    const greyRgb: [number, number, number] = [greyValue, greyValue, greyValue]

    return distance(rgb, greyRgb) < distance(rgb, cubeRgb) ? 232 + greyStep : cubeIndex
}

/** Map #rrggbb to the nearest of the 16 base colour names. */
export function quantizeTo16(hex: string): string {
    const rgb = hexToRgb(hex)
    let best = BASE16[0]
    for (const candidate of BASE16) {
        if (distance(rgb, candidate.rgb) < distance(rgb, best.rgb)) best = candidate
    }
    return best.name
}
