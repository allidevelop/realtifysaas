// Минимальный генератор .xlsx без зависимостей (OOXML SpreadsheetML, STORE-zip).
// Достаточно для экспорта таблиц (АРМ Аналітика). Числа — t="n", текст — inlineStr.

type Cell = string | number | null | undefined

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zipStore(files: { name: string; content: string }[]): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const data = Buffer.from(f.content, 'utf8')
    const name = Buffer.from(f.name, 'utf8')
    const crc = crc32(data)
    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0)
    lfh.writeUInt16LE(20, 4)
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(data.length, 18)
    lfh.writeUInt32LE(data.length, 22)
    lfh.writeUInt16LE(name.length, 26)
    locals.push(lfh, name, data)
    const cdh = Buffer.alloc(46)
    cdh.writeUInt32LE(0x02014b50, 0)
    cdh.writeUInt16LE(20, 4)
    cdh.writeUInt16LE(20, 6)
    cdh.writeUInt32LE(crc, 16)
    cdh.writeUInt32LE(data.length, 20)
    cdh.writeUInt32LE(data.length, 24)
    cdh.writeUInt16LE(name.length, 28)
    cdh.writeUInt32LE(offset, 42)
    central.push(cdh, name)
    offset += lfh.length + name.length + data.length
  }
  const localBuf = Buffer.concat(locals)
  const centralBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(localBuf.length, 16)
  return Buffer.concat([localBuf, centralBuf, eocd])
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colName(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function cellXml(c: Cell, ref: string): string {
  if (c === null || c === undefined || c === '') return `<c r="${ref}"/>`
  if (typeof c === 'number' && Number.isFinite(c)) return `<c r="${ref}" t="n"><v>${c}</v></c>`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(c))}</t></is></c>`
}

/** Собирает .xlsx из заголовков и строк. Возвращает Buffer (один лист). */
export function buildXlsx(sheetName: string, headers: string[], rows: Cell[][]): Buffer {
  const all = [headers, ...rows]
  const sheetData = all
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r.map((c, ci) => cellXml(c, colName(ci) + (ri + 1))).join('')}</row>`,
    )
    .join('')
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${sheetData}</sheetData></worksheet>`
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>'
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${esc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const wbRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>'
  return zipStore([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rootRels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: wbRels },
    { name: 'xl/worksheets/sheet1.xml', content: sheet },
  ])
}
