import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { decodePng } from '../src/render/png.js'

/** Build a minimal 8-bit PNG (colour type 2=RGB or 6=RGBA), filter 0. */
function makePng(width: number, height: number, pixels: number[][], colourType: 2 | 6 = 6): Buffer {
    const bpp = colourType === 6 ? 4 : 3
    const raw: number[] = []
    for (let y = 0; y < height; y++) {
        raw.push(0) // filter: none
        for (let x = 0; x < width; x++) {
            raw.push(...pixels[y * width + x].slice(0, bpp))
        }
    }
    const idat = deflateSync(Buffer.from(raw))
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0)
    ihdr.writeUInt32BE(height, 4)
    ihdr[8] = 8 // bit depth
    ihdr[9] = colourType
    const chunk = (type: string, data: Buffer) => {
        const len = Buffer.alloc(4)
        len.writeUInt32BE(data.length, 0)
        const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
        const crc = Buffer.alloc(4)
        crc.writeUInt32BE(crc32(body), 0)
        return Buffer.concat([len, body, crc])
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
    ])
}

let crcTable: number[] | null = null
function crc32(buf: Buffer): number {
    if (!crcTable) {
        crcTable = []
        for (let n = 0; n < 256; n++) {
            let c = n
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
            crcTable[n] = c >>> 0
        }
    }
    let crc = 0xffffffff
    for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
}

describe('decodePng', () => {

    it('decodes a 2x2 RGBA image', () => {
        // Given: red, green / blue, white
        const png = makePng(2, 2, [
            [255, 0, 0, 255], [0, 255, 0, 255],
            [0, 0, 255, 255], [255, 255, 255, 255],
        ])

        // When
        const image = decodePng(png)

        // Then
        assert.equal(image.width, 2)
        assert.equal(image.height, 2)
        assert.deepEqual([...image.rgba.slice(0, 4)], [255, 0, 0, 255])
        assert.deepEqual([...image.rgba.slice(12, 16)], [255, 255, 255, 255])
    })

    it('decodes RGB (no alpha) to opaque RGBA', () => {
        const png = makePng(1, 1, [[10, 20, 30]], 2)
        const image = decodePng(png)
        assert.deepEqual([...image.rgba], [10, 20, 30, 255])
    })

    it('handles sub and up filters', () => {
        // Given: hand-built two-row image using filter 1 (sub) and 2 (up)
        const raw = Buffer.from([
            1, /* sub */ 100, 0, 0, 255, /**/ 50, 0, 0, 0,   // second px = first + delta
            2, /* up  */ 0, 100, 0, 0, /**/ 0, 0, 0, 0,      // adds row above
        ])
        const idat = deflateSync(raw)
        const ihdr = Buffer.alloc(13)
        ihdr.writeUInt32BE(2, 0)
        ihdr.writeUInt32BE(2, 4)
        ihdr[8] = 8
        ihdr[9] = 6
        const chunk = (type: string, data: Buffer) => {
            const len = Buffer.alloc(4)
            len.writeUInt32BE(data.length, 0)
            const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
            const crc = Buffer.alloc(4)
            crc.writeUInt32BE(crc32(body), 0)
            return Buffer.concat([len, body, crc])
        }
        const png = Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
        ])

        // When
        const image = decodePng(png)

        // Then
        assert.deepEqual([...image.rgba.slice(0, 8)], [100, 0, 0, 255, 150, 0, 0, 255])
        assert.deepEqual([...image.rgba.slice(8, 12)], [100, 100, 0, 255])
    })

    it('rejects non-PNG data', () => {
        assert.throws(() => decodePng(Buffer.from('not a png')), /PNG/)
    })
})
