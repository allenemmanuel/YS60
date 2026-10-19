/** Trim and collapse internal whitespace (handles names pasted from Excel). */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Split pasted text (Excel copy = tab-separated, or CSV) into rows of cells.
 * Handles simple double-quoted CSV fields. Blank lines are dropped.
 */
export function parseRows(text: string): string[][] {
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells = line.includes('\t') ? line.split('\t') : splitCsvLine(line)
    rows.push(cells.map(cleanText))
  }
  return rows
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells
}
