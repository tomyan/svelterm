import { CellBuffer } from './buffer.js'
import { LayoutBox } from '../layout/engine.js'

const TRACK_CHAR = '│'
const THUMB_CHAR = '┃'

export function renderScrollbar(
    buffer: CellBuffer,
    box: LayoutBox,
    contentHeight: number,
    scrollTop: number,
): void {
    if (contentHeight <= box.height) return

    const col = box.x + box.width - 1
    const trackHeight = box.height
    const thumbSize = Math.max(1, Math.round(trackHeight * (box.height / contentHeight)))
    const maxScroll = contentHeight - box.height
    const thumbPos = Math.round((scrollTop / maxScroll) * (trackHeight - thumbSize))

    for (let row = 0; row < trackHeight; row++) {
        const isThumb = row >= thumbPos && row < thumbPos + thumbSize
        buffer.setCell(col, box.y + row, {
            char: isThumb ? THUMB_CHAR : TRACK_CHAR,
            fg: isThumb ? 'white' : 'default',
            dim: !isThumb,
        })
    }
}
