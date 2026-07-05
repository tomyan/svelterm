/**
 * Minimal PNG decoder for <img>: 8-bit RGB/RGBA/greyscale/palette, no
 * interlace, inflate via the web-standard DecompressionStream (Node 18+
 * and browsers) — no dependencies and no node:-scheme imports, so the
 * module loads in browser hosts (embedded previews). Half-block
 * rendering needs pixels, not fidelity; anything fancier should be
 * converted before shipping to a terminal anyway.
 */

/** zlib-wrapped deflate, as PNG IDAT streams are. */
async function inflate(data: Uint8Array): Promise<Uint8Array> {
    const stream = new Blob([data as BlobPart]).stream()
        .pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface DecodedImage {
    width: number
    height: number
    /** Row-major RGBA, 4 bytes per pixel. */
    rgba: Uint8Array
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Bytes per pixel for the colour types we support. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 6: 4 }

export async function decodePng(data: Uint8Array): Promise<DecodedImage> {
    for (let i = 0; i < SIGNATURE.length; i++) {
        if (data[i] !== SIGNATURE[i]) throw new Error('Not a PNG file')
    }

    let width = 0
    let height = 0
    let colourType = -1
    let palette: Uint8Array | null = null
    const idat: Uint8Array[] = []

    let offset = 8
    while (offset + 8 <= data.length) {
        const length = readU32(data, offset)
        const type = String.fromCharCode(...data.slice(offset + 4, offset + 8))
        const body = data.slice(offset + 8, offset + 8 + length)
        if (type === 'IHDR') {
            width = readU32(body, 0)
            height = readU32(body, 4)
            const bitDepth = body[8]
            colourType = body[9]
            if (bitDepth !== 8) throw new Error(`PNG bit depth ${bitDepth} not supported (8 only)`)
            if (!(colourType in CHANNELS)) throw new Error(`PNG colour type ${colourType} not supported`)
            if (body[12] !== 0) throw new Error('Interlaced PNG not supported')
        } else if (type === 'PLTE') {
            palette = body
        } else if (type === 'IDAT') {
            idat.push(body)
        } else if (type === 'IEND') {
            break
        }
        offset += 12 + length
    }
    if (width === 0 || height === 0 || idat.length === 0) throw new Error('Truncated PNG')

    const channels = CHANNELS[colourType]
    const raw = await inflate(concat(idat))
    const stride = width * channels
    const unfiltered = unfilter(raw, width, height, channels)

    const rgba = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const src = y * stride + x * channels
            const dst = (y * width + x) * 4
            switch (colourType) {
                case 6:
                    rgba.set(unfiltered.slice(src, src + 4), dst)
                    break
                case 2:
                    rgba.set(unfiltered.slice(src, src + 3), dst)
                    rgba[dst + 3] = 255
                    break
                case 0: {
                    const grey = unfiltered[src]
                    rgba[dst] = grey; rgba[dst + 1] = grey; rgba[dst + 2] = grey
                    rgba[dst + 3] = 255
                    break
                }
                case 3: {
                    const index = unfiltered[src] * 3
                    rgba[dst] = palette?.[index] ?? 0
                    rgba[dst + 1] = palette?.[index + 1] ?? 0
                    rgba[dst + 2] = palette?.[index + 2] ?? 0
                    rgba[dst + 3] = 255
                    break
                }
            }
        }
    }
    return { width, height, rgba }
}

/** Undo per-row PNG filters (types 0–4). */
function unfilter(raw: Uint8Array, width: number, height: number, channels: number): Uint8Array {
    const stride = width * channels
    const out = new Uint8Array(stride * height)
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)]
        const rowIn = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1))
        const rowOut = out.subarray(y * stride, (y + 1) * stride)
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
        for (let i = 0; i < stride; i++) {
            const left = i >= channels ? rowOut[i - channels] : 0
            const up = prev ? prev[i] : 0
            const upLeft = prev && i >= channels ? prev[i - channels] : 0
            let value = rowIn[i]
            switch (filter) {
                case 1: value += left; break
                case 2: value += up; break
                case 3: value += Math.floor((left + up) / 2); break
                case 4: value += paeth(left, up, upLeft); break
            }
            rowOut[i] = value & 0xff
        }
    }
    return out
}

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc) return a
    if (pb <= pc) return b
    return c
}

function readU32(data: Uint8Array, offset: number): number {
    return (data[offset] << 24 | data[offset + 1] << 16 | data[offset + 2] << 8 | data[offset + 3]) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, p) => sum + p.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const part of parts) { out.set(part, offset); offset += part.length }
    return out
}
