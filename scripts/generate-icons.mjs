/**
 * 從品牌主視覺 public/teampro-poomsae-coach-logo.png 產生所有 favicon / PWA 圖示。
 *
 * 純 Node（只用內建 zlib），不需要 sharp 之類的影像套件，
 * 這樣 CI 或別台電腦重跑也不會因為缺套件而把品牌圖示洗掉。
 *
 * 執行：node scripts/generate-icons.mjs
 */
import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = join(ROOT, 'public')
const ICON_DIR = join(PUBLIC_DIR, 'icons')
const SOURCE = join(PUBLIC_DIR, 'teampro-poomsae-coach-logo.png')

/*
 * 檔名帶版本號：換圖示時把 VERSION 加一並同步 index.html / vite.config.ts。
 * 瀏覽器與 Android 主畫面對舊檔名的快取極黏，改路徑是最可靠的更新方式。
 */
const VERSION = 'v2'

// ---------------------------------------------------------------- PNG 編解碼

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** 解出 { width, height, rgb }，rgb 為 width*height*3 的 Buffer（丟棄 alpha，以黑底合成）。 */
function decodePng(buffer) {
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  const depth = buffer[24]
  const colorType = buffer[25]
  const interlace = buffer[28]
  if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`只支援 8-bit 非交錯的 RGB/RGBA PNG（depth=${depth} color=${colorType})`)
  }

  const idat = []
  let offset = 8
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    if (type === 'IDAT') idat.push(buffer.subarray(offset + 8, offset + 8 + length))
    if (type === 'IEND') break
    offset += length + 12
  }

  const raw = inflateSync(Buffer.concat(idat))
  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels
  const pixels = Buffer.alloc(height * stride)

  // PNG 逐列 filter 還原（filter type 0~4）
  let pos = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos]
    pos += 1
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const out = pixels.subarray(y * stride, (y + 1) * stride)
    const prior = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? out[i - channels] : 0
      const b = prior ? prior[i] : 0
      const c = prior && i >= channels ? prior[i - channels] : 0
      let value = line[i]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      out[i] = value & 0xff
    }
  }

  if (channels === 3) return { width, height, rgb: pixels }

  const rgb = Buffer.alloc(width * height * 3)
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
    const alpha = pixels[i + 3] / 255
    rgb[j] = Math.round(pixels[i] * alpha)
    rgb[j + 1] = Math.round(pixels[i + 1] * alpha)
    rgb[j + 2] = Math.round(pixels[i + 2] * alpha)
  }
  return { width, height, rgb }
}

function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (width * 3 + 1))
  let offset = 0
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0 // filter type: none
    offset += 1
    rgb.copy(raw, offset, y * width * 3, (y + 1) * width * 3)
    offset += width * 3
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ------------------------------------------------------------------ 縮圖合成

/** 面積平均（box filter）縮圖，縮很多倍時比取樣點乾淨得多。 */
function resample(src, targetWidth, targetHeight) {
  const out = Buffer.alloc(targetWidth * targetHeight * 3)
  const scaleX = src.width / targetWidth
  const scaleY = src.height / targetHeight

  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor(y * scaleY)
    const y1 = Math.max(y0 + 1, Math.min(src.height, Math.ceil((y + 1) * scaleY)))
    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor(x * scaleX)
      const x1 = Math.max(x0 + 1, Math.min(src.width, Math.ceil((x + 1) * scaleX)))
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let sy = y0; sy < y1; sy += 1) {
        let idx = (sy * src.width + x0) * 3
        for (let sx = x0; sx < x1; sx += 1) {
          r += src.rgb[idx]
          g += src.rgb[idx + 1]
          b += src.rgb[idx + 2]
          idx += 3
          count += 1
        }
      }
      const idx = (y * targetWidth + x) * 3
      out[idx] = Math.round(r / count)
      out[idx + 1] = Math.round(g / count)
      out[idx + 2] = Math.round(b / count)
    }
  }
  return { width: targetWidth, height: targetHeight, rgb: out }
}

/**
 * 產生正方形圖示。
 * padding 為每邊留白比例：Android maskable 會把四角裁掉，
 * 留白不夠的話「Poomsae Coach」字樣會被切掉，看起來就像換了一顆舊圖示。
 */
function makeIcon(src, size, padding, padColor) {
  const inner = Math.max(1, Math.round(size * (1 - padding * 2)))
  const scaled = resample(src, inner, inner)
  if (inner === size) return { width: size, height: size, rgb: scaled.rgb }

  const out = Buffer.alloc(size * size * 3)
  for (let i = 0; i < size * size; i += 1) {
    out[i * 3] = padColor[0]
    out[i * 3 + 1] = padColor[1]
    out[i * 3 + 2] = padColor[2]
  }
  const offset = Math.round((size - inner) / 2)
  for (let y = 0; y < inner; y += 1) {
    scaled.rgb.copy(out, ((y + offset) * size + offset) * 3, y * inner * 3, (y + 1) * inner * 3)
  }
  return { width: size, height: size, rgb: out }
}

// ---------------------------------------------------------------------- 輸出

const source = decodePng(readFileSync(SOURCE))
// 主視覺四角是純黑，補邊就取來源角落像素，maskable 放大裁切時看不出接縫
const padColor = [source.rgb[0], source.rgb[1], source.rgb[2]]

mkdirSync(ICON_DIR, { recursive: true })

const outputs = [
  [join(PUBLIC_DIR, `favicon-${VERSION}-32.png`), makeIcon(source, 32, 0, padColor)],
  [join(PUBLIC_DIR, `favicon-${VERSION}-64.png`), makeIcon(source, 64, 0, padColor)],
  [join(PUBLIC_DIR, `favicon-${VERSION}-180.png`), makeIcon(source, 180, 0, padColor)],
  [join(ICON_DIR, `poomsae-coach-${VERSION}-192.png`), makeIcon(source, 192, 0, padColor)],
  [join(ICON_DIR, `poomsae-coach-${VERSION}-512.png`), makeIcon(source, 512, 0, padColor)],
  [
    join(ICON_DIR, `poomsae-coach-${VERSION}-maskable-512.png`),
    makeIcon(source, 512, 0.14, padColor),
  ],
  [join(ICON_DIR, `poomsae-coach-${VERSION}-apple-touch.png`), makeIcon(source, 180, 0, padColor)],
]

for (const [path, image] of outputs) {
  const buffer = encodePng(image.width, image.height, image.rgb)
  writeFileSync(path, buffer)
  console.log(`已產生 ${path.slice(ROOT.length + 1)}（${buffer.length} bytes）`)
}
