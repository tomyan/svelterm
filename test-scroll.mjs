import { stdin, stdout } from 'node:process'

function write(s) { stdout.write(s) }
function csi(s) { write(`\x1b[${s}`) }

// Fill viewport with labeled lines
const rows = parseInt(process.argv[2] || '20')
for (let i = 1; i <= rows; i++) {
  const color = i <= 10 ? '36' : '33' // cyan for 1-10, yellow for 11-20
  write(`\x1b[${color}m  line ${String(i).padStart(2)}  \x1b[0m\n`)
}

write('\n--- Press S to scroll up 3, T to scroll down 3, R for scroll region demo, Q to quit ---\n')

stdin.setRawMode(true)
stdin.resume()
stdin.on('data', (data) => {
  const key = String.fromCharCode(data[0]).toLowerCase()
  if (key === 'q' || data[0] === 3) {
    stdin.setRawMode(false)
    write('\n')
    process.exit(0)
  } else if (key === 's') {
    // CSI 3 S — scroll up 3 lines (content moves up, 3 blank lines at bottom)
    csi('3S')
    write('\r\x1b[33m  ^ scrolled up 3 (CSI 3 S) — top lines went to scrollback\x1b[0m')
  } else if (key === 't') {
    // CSI 3 T — scroll down 3 lines (content moves down, 3 blank lines at top)
    csi('3T')
    write('\r\x1b[33m  v scrolled down 3 (CSI 3 T) — bottom lines lost\x1b[0m')
  } else if (key === 'r') {
    // DECSTBM: set scroll region to rows 5-15, scroll up 2 within it
    csi('5;15r')   // set scroll region
    csi('2S')      // scroll up 2 within region
    csi('r')       // reset scroll region
    csi(`${rows + 2};1H`) // move cursor back to bottom
    write('\x1b[33m  scroll region demo: rows 5-15 scrolled up 2 (rest untouched)\x1b[0m')
  }
})
