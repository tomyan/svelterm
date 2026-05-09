import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { render, el, text, rowText } from './harness.js'

describe('integration: table element recognition', () => {

    it('thead/tbody/tfoot/caption/colgroup/col get correct default display', () => {
        // Given
        const thead = el('thead')
        const tbody = el('tbody')
        const tfoot = el('tfoot')
        const caption = el('caption')
        const colgroup = el('colgroup')
        const col = el('col')
        const tree = el('table', {}, [caption, colgroup, col, thead, tbody, tfoot])

        // When
        const { styles } = render(tree, { css: '', width: 10, height: 5 })

        // Then
        assert.equal(styles.get(thead.id)?.display, 'table-header-group')
        assert.equal(styles.get(tbody.id)?.display, 'table-row-group')
        assert.equal(styles.get(tfoot.id)?.display, 'table-footer-group')
        assert.equal(styles.get(caption.id)?.display, 'table-caption')
        assert.equal(styles.get(colgroup.id)?.display, 'table-column-group')
        assert.equal(styles.get(col.id)?.display, 'table-column')
    })

    it('display CSS property accepts the new table-* values', () => {
        // Given
        const target = el('div', { class: 'group' })
        const tree = el('div', {}, [target])
        const css = '.group { display: table-row-group; }'

        // When
        const { styles } = render(tree, { css, width: 10, height: 5 })

        // Then
        assert.equal(styles.get(target.id)?.display, 'table-row-group')
    })

    it('display: inline-table accepted by parser', () => {
        // Given
        const target = el('div', { class: 'it' })
        const tree = el('div', {}, [target])
        const css = '.it { display: inline-table; }'

        // When
        const { styles } = render(tree, { css, width: 10, height: 5 })

        // Then
        assert.equal(styles.get(target.id)?.display, 'inline-table')
    })
})

describe('integration: table layout', () => {

    it('basic table positions cells in rows and columns', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [
                el('td', {}, [text('A1')]),
                el('td', {}, [text('B1')]),
            ]),
            el('tr', {}, [
                el('td', {}, [text('A2')]),
                el('td', {}, [text('B2')]),
            ]),
        ])

        // When
        const { buffer } = render(tree, {
            css: '',
            width: 30, height: 5,
        })

        // Then: cells rendered in grid pattern
        const row0 = rowText(buffer, 0)
        assert.ok(row0.includes('A1'), `row 0 should contain A1: "${row0}"`)
        assert.ok(row0.includes('B1'), `row 0 should contain B1: "${row0}"`)

        const row1 = rowText(buffer, 1)
        assert.ok(row1.includes('A2'), `row 1 should contain A2: "${row1}"`)
    })

    it('renders sections in spec order: header → body → footer regardless of source order', () => {
        // Given: source order is footer, body, header (reversed)
        const tree = el('table', {}, [
            el('tfoot', {}, [
                el('tr', {}, [el('td', {}, [text('FOOT')])]),
            ]),
            el('tbody', {}, [
                el('tr', {}, [el('td', {}, [text('BODY')])]),
            ]),
            el('thead', {}, [
                el('tr', {}, [el('td', {}, [text('HEAD')])]),
            ]),
        ])

        // When
        const { buffer } = render(tree, { css: '', width: 30, height: 5 })

        // Then: header first, body next, footer last
        assert.ok(rowText(buffer, 0).includes('HEAD'), `row 0: "${rowText(buffer, 0)}"`)
        assert.ok(rowText(buffer, 1).includes('BODY'), `row 1: "${rowText(buffer, 1)}"`)
        assert.ok(rowText(buffer, 2).includes('FOOT'), `row 2: "${rowText(buffer, 2)}"`)
    })

    it('bare tr children of table render as an implicit body', () => {
        // Given: explicit thead, then bare <tr>s (no <tbody>) — browsers' parser
        // auto-inserts a tbody; we do the equivalent at layout time.
        const tree = el('table', {}, [
            el('thead', {}, [
                el('tr', {}, [el('td', {}, [text('HEAD')])]),
            ]),
            el('tr', {}, [el('td', {}, [text('A1')])]),
            el('tr', {}, [el('td', {}, [text('A2')])]),
        ])

        // When
        const { buffer } = render(tree, { css: '', width: 30, height: 5 })

        // Then
        assert.ok(rowText(buffer, 0).includes('HEAD'), `row 0: "${rowText(buffer, 0)}"`)
        assert.ok(rowText(buffer, 1).includes('A1'), `row 1: "${rowText(buffer, 1)}"`)
        assert.ok(rowText(buffer, 2).includes('A2'), `row 2: "${rowText(buffer, 2)}"`)
    })

    it('multiple tbody sections render in source order between thead and tfoot', () => {
        // Given
        const tree = el('table', {}, [
            el('thead', {}, [el('tr', {}, [el('td', {}, [text('H')])])]),
            el('tbody', {}, [el('tr', {}, [el('td', {}, [text('B1')])])]),
            el('tbody', {}, [el('tr', {}, [el('td', {}, [text('B2')])])]),
            el('tfoot', {}, [el('tr', {}, [el('td', {}, [text('F')])])]),
        ])

        // When
        const { buffer } = render(tree, { css: '', width: 30, height: 5 })

        // Then
        assert.ok(rowText(buffer, 0).includes('H'))
        assert.ok(rowText(buffer, 1).includes('B1'))
        assert.ok(rowText(buffer, 2).includes('B2'))
        assert.ok(rowText(buffer, 3).includes('F'))
    })

    it('caption renders above the table by default', () => {
        // Given
        const tree = el('table', {}, [
            el('caption', {}, [text('TITLE')]),
            el('tbody', {}, [
                el('tr', {}, [el('td', {}, [text('A')])]),
                el('tr', {}, [el('td', {}, [text('B')])]),
            ]),
        ])

        // When
        const { buffer } = render(tree, { css: '', width: 30, height: 5 })

        // Then
        assert.ok(rowText(buffer, 0).includes('TITLE'), `row 0: "${rowText(buffer, 0)}"`)
        assert.ok(rowText(buffer, 1).includes('A'), `row 1: "${rowText(buffer, 1)}"`)
        assert.ok(rowText(buffer, 2).includes('B'), `row 2: "${rowText(buffer, 2)}"`)
    })

    it('caption-side: bottom renders the caption below the table', () => {
        // Given
        const tree = el('table', {}, [
            el('caption', {}, [text('TITLE')]),
            el('tbody', {}, [
                el('tr', {}, [el('td', {}, [text('A')])]),
                el('tr', {}, [el('td', {}, [text('B')])]),
            ]),
        ])
        const css = 'caption { caption-side: bottom; }'

        // When
        const { buffer } = render(tree, { css, width: 30, height: 5 })

        // Then
        assert.ok(rowText(buffer, 0).includes('A'), `row 0: "${rowText(buffer, 0)}"`)
        assert.ok(rowText(buffer, 1).includes('B'), `row 1: "${rowText(buffer, 1)}"`)
        assert.ok(rowText(buffer, 2).includes('TITLE'), `row 2: "${rowText(buffer, 2)}"`)
    })

    it('th defaults to bold + centered text', () => {
        // Given
        const th = el('th', {}, [text('Name')])
        const tree = el('table', {}, [
            el('thead', {}, [el('tr', {}, [th])]),
            el('tbody', {}, [el('tr', {}, [el('td', {}, [text('Alice')])])]),
        ])

        // When
        const { styles } = render(tree, { css: '', width: 30, height: 5 })

        // Then
        const thStyle = styles.get(th.id)!
        assert.equal(thStyle.bold, true, 'th should be bold by default')
        assert.equal(thStyle.textAlign, 'center', 'th should be center-aligned by default')
    })

    it('colspan: cell box covers N columns plus the gaps between them', () => {
        // Given: row 0 establishes 3 columns of width 2 each ("AA"/"BB"/"CC").
        // Row 1 has a colspan=2 cell followed by a regular cell.
        const spanned = el('td', { colspan: '2' }, [text('SP')])
        const tree = el('table', {}, [
            el('tbody', {}, [
                el('tr', {}, [
                    el('td', {}, [text('AA')]),
                    el('td', {}, [text('BB')]),
                    el('td', {}, [text('CC')]),
                ]),
                el('tr', {}, [
                    spanned,
                    el('td', {}, [text('DD')]),
                ]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 5 })

        // Then: spanned width = col0 (2) + gap (2) + col1 (2) = 6
        const spannedBox = layout.get(spanned.id)!
        assert.equal(spannedBox.width, 6, `colspan=2 width should be 6, got ${spannedBox.width}`)
    })

    it('colspan: cell after a spanned cell starts at the next free column', () => {
        // Given: row 0 sets 3 cols at "AAA"/"B"/"CC". Row 1 colspan=2 then DD.
        // DD must start at column 2's x-position.
        const dd = el('td', {}, [text('DD')])
        const tree = el('table', {}, [
            el('tbody', {}, [
                el('tr', {}, [
                    el('td', {}, [text('AAA')]),
                    el('td', {}, [text('B')]),
                    el('td', {}, [text('CC')]),
                ]),
                el('tr', {}, [
                    el('td', { colspan: '2' }, [text('S')]),
                    dd,
                ]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 5 })

        // Then: column 2 starts at x = colW[0] (3) + gap (2) + colW[1] (1) + gap (2) = 8
        const ddBox = layout.get(dd.id)!
        assert.equal(ddBox.x, 8, `DD should be at x=8 (start of col 2), got ${ddBox.x}`)
    })

    it('rowspan: cell box height covers N rows; later rows skip the occupied slot', () => {
        // Given: row 0 has a rowspan=2 cell + B0; row 1 has only B1 (because col 0 is taken).
        const spanned = el('td', { rowspan: '2' }, [text('S')])
        const b1 = el('td', {}, [text('B1')])
        const tree = el('table', {}, [
            el('tbody', {}, [
                el('tr', {}, [spanned, el('td', {}, [text('B0')])]),
                el('tr', {}, [b1]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 5 })

        // Then: spanned height covers 2 rows; B1 sits in column 1
        const spannedBox = layout.get(spanned.id)!
        const b1Box = layout.get(b1.id)!
        assert.equal(spannedBox.height, 2, `rowspan=2 height should be 2, got ${spannedBox.height}`)
        // S is in col 0 (width 1); B0 is in col 1 (width 2). Column 1 starts at x = 1 + gap (2) = 3.
        assert.equal(b1Box.x, 3, `B1 should be at x=3 (col 1), got ${b1Box.x}`)
    })

    it('combined colspan + rowspan: cell covers a 2x2 block', () => {
        // Given: row 0 has [SPAN 2x2] [C0]; row 1 has only [C1]; row 2 has [E][F][G].
        const span = el('td', { colspan: '2', rowspan: '2' }, [text('S')])
        const c1 = el('td', {}, [text('C1')])
        const e = el('td', {}, [text('E')])
        const tree = el('table', {}, [
            el('tbody', {}, [
                el('tr', {}, [span, el('td', {}, [text('C0')])]),
                el('tr', {}, [c1]),
                el('tr', {}, [e, el('td', {}, [text('F')]), el('td', {}, [text('G')])]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 10 })

        // Then
        const spanBox = layout.get(span.id)!
        const c1Box = layout.get(c1.id)!
        const eBox = layout.get(e.id)!
        // SPAN width covers cols 0+1 (from row 2: E width 1 + GAP + F width 1 = 4)
        assert.equal(spanBox.width, 4, `SPAN width should be 4, got ${spanBox.width}`)
        // SPAN height covers 2 rows (row 0 + row 1, each height 1)
        assert.equal(spanBox.height, 2, `SPAN height should be 2, got ${spanBox.height}`)
        // C1 is in col 2 (cols 0+1 occupied by SPAN); col 2 starts at 1+2+1+2 = 6
        assert.equal(c1Box.x, 6, `C1 should be at x=6 (col 2), got ${c1Box.x}`)
        // E is in row 2, col 0
        assert.equal(eBox.x, 0, `E should be at x=0 (col 0), got ${eBox.x}`)
    })

    it('colspan=0: cell spans all remaining columns', () => {
        // Given: row 0 establishes 3 columns. Row 1 has a colspan=0 cell that fills all 3.
        const full = el('td', { colspan: '0' }, [text('FULL')])
        const tree = el('table', {}, [
            el('tbody', {}, [
                el('tr', {}, [
                    el('td', {}, [text('AA')]),
                    el('td', {}, [text('BB')]),
                    el('td', {}, [text('CC')]),
                ]),
                el('tr', {}, [full]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 5 })

        // Then: full width = 3 cols (each width 2) + 2 gaps = 6 + 4 = 10
        const fullBox = layout.get(full.id)!
        assert.equal(fullBox.width, 10, `colspan=0 width should be 10, got ${fullBox.width}`)
    })

    it('CSS width on td makes its column at least that wide', () => {
        // Given
        const wide = el('td', { style: 'width: 10cell' }, [text('A')])
        const tree = el('table', {}, [
            el('tbody', {}, [
                el('tr', {}, [wide, el('td', {}, [text('B')])]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 5 })

        // Then
        const wideBox = layout.get(wide.id)!
        assert.ok(wideBox.width >= 10, `td width should be >= 10, got ${wideBox.width}`)
    })

    it('<col> CSS width applies to the matching column', () => {
        // Given: col 0 sized to 10cell; cell content is short.
        const a = el('td', {}, [text('A')])
        const tree = el('table', {}, [
            el('col', { style: 'width: 10cell' }),
            el('col'),
            el('tbody', {}, [
                el('tr', {}, [a, el('td', {}, [text('B')])]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 40, height: 5 })

        // Then
        const aBox = layout.get(a.id)!
        assert.ok(aBox.width >= 10, `col 0 should be >= 10, got ${aBox.width}`)
    })

    it('<col span="2"> applies the same width to multiple columns', () => {
        // Given: span=2 with width 5 sizes cols 0 and 1 to >= 5 each.
        const a = el('td', {}, [text('A')])
        const b = el('td', {}, [text('B')])
        const tree = el('table', {}, [
            el('col', { span: '2', style: 'width: 5cell' }),
            el('tbody', {}, [
                el('tr', {}, [a, b, el('td', {}, [text('C')])]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 40, height: 5 })

        // Then
        const aBox = layout.get(a.id)!
        const bBox = layout.get(b.id)!
        assert.ok(aBox.width >= 5, `col 0 should be >= 5, got ${aBox.width}`)
        assert.ok(bBox.width >= 5, `col 1 should be >= 5, got ${bBox.width}`)
    })

    it('table-layout: fixed: cells in later rows do not grow columns', () => {
        // Given: cols 0 and 1 sized 5cell each via <col>. Row 2 has very long
        // content in col 0; under fixed layout this must not stretch col 0.
        const wide = el('td', {}, [text('THIS IS A REALLY LONG STRING')])
        const tree = el('table', { style: 'table-layout: fixed' }, [
            el('col', { style: 'width: 5cell' }),
            el('col', { style: 'width: 5cell' }),
            el('tbody', {}, [
                el('tr', {}, [el('td', {}, [text('A')]), el('td', {}, [text('B')])]),
                el('tr', {}, [wide, el('td', {}, [text('D')])]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 40, height: 8 })

        // Then
        const wideBox = layout.get(wide.id)!
        assert.equal(wideBox.width, 5, `fixed col 0 should be 5, got ${wideBox.width}`)
    })

    it('table-layout: fixed: col widths come from <col> first, then first row', () => {
        // Given: col 0 has explicit width via <col>; col 1 takes its width from
        // the first row's cell.
        const a = el('td', {}, [text('A')])
        const b = el('td', { style: 'width: 7cell' }, [text('B')])
        const tree = el('table', { style: 'table-layout: fixed' }, [
            el('col', { style: 'width: 4cell' }),
            el('tbody', {}, [
                el('tr', {}, [a, b]),
                // long content in row 2 must not change either column
                el('tr', {}, [
                    el('td', {}, [text('XXXXXXXXXX')]),
                    el('td', {}, [text('YYYYYYYYYY')]),
                ]),
            ]),
        ])

        // When
        const { layout } = render(tree, { css: '', width: 40, height: 8 })

        // Then
        const aBox = layout.get(a.id)!
        const bBox = layout.get(b.id)!
        assert.equal(aBox.width, 4, `col 0 from <col> should be 4, got ${aBox.width}`)
        assert.equal(bBox.width, 7, `col 1 from first-row cell should be 7, got ${bBox.width}`)
    })

    it('CSS height on tr makes the row at least that tall', () => {
        // Given
        const tr = el('tr', { style: 'height: 3cell' }, [el('td', {}, [text('A')])])
        const tree = el('table', {}, [el('tbody', {}, [tr])])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 10 })

        // Then
        const trBox = layout.get(tr.id)!
        assert.equal(trBox.height, 3, `tr should be at least 3 tall, got ${trBox.height}`)
    })

    it('vertical-align: bottom positions cell content at the bottom of a tall row', () => {
        // Given
        const cell = el('td', { style: 'vertical-align: bottom' }, [text('B')])
        const tr = el('tr', { style: 'height: 3cell' }, [cell])
        const tree = el('table', {}, [el('tbody', {}, [tr])])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 10 })

        // Then: text node y should be at row bottom (row height 3, content height 1 → y=2)
        const textNode = cell.children[0]
        const textBox = layout.get(textNode.id)!
        assert.equal(textBox.y, 2, `bottom-aligned text should be at y=2, got ${textBox.y}`)
    })

    it('vertical-align: middle centers content in a tall row', () => {
        // Given
        const cell = el('td', { style: 'vertical-align: middle' }, [text('M')])
        const tr = el('tr', { style: 'height: 5cell' }, [cell])
        const tree = el('table', {}, [el('tbody', {}, [tr])])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 10 })

        // Then: text y = floor((5-1) / 2) = 2
        const textNode = cell.children[0]
        const textBox = layout.get(textNode.id)!
        assert.equal(textBox.y, 2, `middle-aligned text should be at y=2, got ${textBox.y}`)
    })

    it('vertical-align: top (default) leaves content at the top', () => {
        // Given
        const cell = el('td', {}, [text('T')])
        const tr = el('tr', { style: 'height: 4cell' }, [cell])
        const tree = el('table', {}, [el('tbody', {}, [tr])])

        // When
        const { layout } = render(tree, { css: '', width: 30, height: 10 })

        // Then
        const textNode = cell.children[0]
        const textBox = layout.get(textNode.id)!
        assert.equal(textBox.y, 0, `top-aligned text should be at y=0, got ${textBox.y}`)
    })

    it('caption defaults to centered text', () => {
        // Given
        const caption = el('caption', {}, [text('Title')])
        const tree = el('table', {}, [
            caption,
            el('tbody', {}, [el('tr', {}, [el('td', {}, [text('A')])])]),
        ])

        // When
        const { styles } = render(tree, { css: '', width: 30, height: 5 })

        // Then
        assert.equal(styles.get(caption.id)?.textAlign, 'center')
    })

    it('column width is determined by widest cell', () => {
        // Given
        const tree = el('table', {}, [
            el('tr', {}, [
                el('td', {}, [text('Short')]),
                el('td', {}, [text('X')]),
            ]),
            el('tr', {}, [
                el('td', {}, [text('Longer Text')]),
                el('td', {}, [text('Y')]),
            ]),
        ])

        // When
        const { layout } = render(tree, {
            css: '',
            width: 40, height: 5,
        })

        // Then: first column should be at least as wide as "Longer Text" (11 chars)
        const firstRow = tree.children[0]
        const firstCell = firstRow.children[0]
        const firstCellBox = layout.get(firstCell.id)!
        assert.ok(firstCellBox.width >= 11, `first column width should be >= 11 but was ${firstCellBox.width}`)
    })
})
