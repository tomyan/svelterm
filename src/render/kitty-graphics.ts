/**
 * Kitty graphics protocol: transmit RGBA pixels and place them scaled to
 * a cell box, for crisp `<img>` rendering on supporting terminals. The
 * half-block path (render/image.ts) stays the default; this activates
 * only when capability detection reports graphics support.
 *
 * Protocol: commands are APC sequences `ESC _ G <key=val,...> ; <base64>
 * ESC \`. Payloads chunk into ≤4096 base64 chars with `m=1` on every
 * segment but the last.
 */

import type { DecodedImage } from './png.js'

const APC = '\x1b_G'
const ST = '\x1b\\'
const CHUNK = 4096

/** Terminals that speak the kitty graphics protocol (by XTVERSION name). */
const GRAPHICS_TERMINALS = /kitty|ghostty|wezterm/i

export function graphicsSupported(xtversion: string | null): boolean {
    return xtversion !== null && GRAPHICS_TERMINALS.test(xtversion)
}

/** Base64 of the image's RGBA bytes. */
function encodePayload(image: DecodedImage): string {
    if (typeof Buffer !== 'undefined') return Buffer.from(image.rgba).toString('base64')
    let binary = ''
    for (const byte of image.rgba) binary += String.fromCharCode(byte)
    return btoa(binary)
}

/**
 * Transmit (but don't display) an image's pixels under an id, for later
 * placement. Chunked so no single APC exceeds the protocol limit.
 */
export function transmitImage(imageId: number, image: DecodedImage): string {
    const payload = encodePayload(image)
    const control = `a=t,f=32,i=${imageId},s=${image.width},v=${image.height}`
    if (payload.length <= CHUNK) {
        return `${APC}${control},m=0;${payload}${ST}`
    }
    const parts: string[] = []
    for (let offset = 0; offset < payload.length; offset += CHUNK) {
        const chunk = payload.slice(offset, offset + CHUNK)
        const more = offset + CHUNK < payload.length ? 1 : 0
        // The control keys only need to appear on the first chunk
        const head = offset === 0 ? `${control},m=${more}` : `m=${more}`
        parts.push(`${APC}${head};${chunk}${ST}`)
    }
    return parts.join('')
}

/**
 * Place a transmitted image at the current cursor position, scaled to
 * `cols`×`rows` cells, without moving the cursor (`C=1`).
 */
export function placeImage(imageId: number, placementId: number, cols: number, rows: number): string {
    return `${APC}a=p,i=${imageId},p=${placementId},c=${cols},r=${rows},C=1;${ST}`
}

/** Delete one placement, leaving the transmitted image data intact. */
export function deletePlacement(imageId: number, placementId: number): string {
    return `${APC}a=d,d=i,i=${imageId},p=${placementId};${ST}`
}
