/**
 * Generates the PWA app icons in `public/icons/`.
 *
 *   node scripts/gen-icons.mjs
 *
 * The icons are rasterised here rather than exported from a design tool so the
 * brand mark, the gradient and the sizes all stay in one place: change the
 * constants below and re-run. `public/logo.svg` remains the vector source of
 * truth and is kept byte-identical — this script reproduces its geometry.
 *
 * Deliberately dependency-free. `sharp` cannot run on Workers, and adding a
 * native image library purely to build four static assets would be a poor trade.
 * PNG is assembled by hand: an indexed-colour (palette) image with a single
 * filter, deflated with Node's zlib.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

// ── Brand ────────────────────────────────────────────────────────────────────
/** Gradient endpoints, matching the `twivterGrad` stops in public/logo.svg. */
const GRADIENT_FROM = [0x3b, 0x82, 0xf6]
const GRADIENT_TO = [0x8b, 0x5c, 0xf6]

/**
 * The "Y" mark, as a closed polygon in the 120×120 viewBox of logo.svg.
 * Same path data: M28 38 L52 72 L52 88 L68 88 L68 72 L92 38 L80 38 L60 64 L40 38 Z
 */
const MARK = [
  [28, 38], [52, 72], [52, 88], [68, 88], [68, 72],
  [92, 38], [80, 38], [60, 64], [40, 38],
]

/**
 * Outputs. `markScale` is the mark's width as a fraction of the icon: the mark
 * spans 64 of the viewBox's 120 units, so pixels-per-unit is derived from it.
 *
 * `maskable` variants are additionally inset, because Android crops a maskable
 * icon to a circle covering the middle 80% — anything outside that is lost.
 */
const OUTPUTS = [
  { name: 'icon-192', size: 192, markWidth: 0.44 },
  { name: 'icon-512', size: 512, markWidth: 0.44 },
  { name: 'icon-maskable-512', size: 512, markWidth: 0.32 },
  { name: 'apple-touch-icon', size: 180, markWidth: 0.5 },
]

// ── Rasteriser ───────────────────────────────────────────────────────────────
/** Anti-aliasing: 3×3 subsamples per pixel. */
const SUBSAMPLES = 3

/** Gradient parameter at a pixel, matching `x1=0 y1=0 x2=120 y2=120`. */
function gradientAt(x, y, size) {
  const t = Math.min(1, Math.max(0, (x + y) / (2 * size)))
  return [
    Math.round(GRADIENT_FROM[0] + (GRADIENT_TO[0] - GRADIENT_FROM[0]) * t),
    Math.round(GRADIENT_FROM[1] + (GRADIENT_TO[1] - GRADIENT_FROM[1]) * t),
    Math.round(GRADIENT_FROM[2] + (GRADIENT_TO[2] - GRADIENT_FROM[2]) * t),
  ]
}

/** Even-odd point-in-polygon. */
function inside(poly, px, py) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      hit = !hit
    }
  }
  return hit
}

function rasterise(size, markWidth) {
  const k = (size * markWidth) / 64
  const centre = size / 2
  const poly = MARK.map(([x, y]) => [(x - 60) * k + centre, (y - 60) * k + centre])

  const rgb = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0
      for (let sy = 0; sy < SUBSAMPLES; sy++) {
        for (let sx = 0; sx < SUBSAMPLES; sx++) {
          const px = x + (sx + 0.5) / SUBSAMPLES
          const py = y + (sy + 0.5) / SUBSAMPLES
          if (inside(poly, px, py)) covered++
        }
      }
      const base = gradientAt(x + 0.5, y + 0.5, size)
      const o = (y * size + x) * 3
      if (covered === 0) {
        rgb[o] = base[0]
        rgb[o + 1] = base[1]
        rgb[o + 2] = base[2]
      } else {
        // Blend the mark's white over the gradient by coverage.
        const a = covered / (SUBSAMPLES * SUBSAMPLES)
        rgb[o] = Math.round(base[0] + (255 - base[0]) * a)
        rgb[o + 1] = Math.round(base[1] + (255 - base[1]) * a)
        rgb[o + 2] = Math.round(base[2] + (255 - base[2]) * a)
      }
    }
  }
  return rgb
}

// ── PNG encoder ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, Buffer.from(data), crc])
}

/**
 * Encodes truecolour-with-palette PNG. A smooth gradient stored as 8-bit RGB
 * costs ~130 KB at 512px; quantised to a palette of the colours actually used
 * it lands under 10 KB, and the banding is invisible at icon sizes.
 */
function encodePng(size, rgb) {
  // Quantise to 5 bits per channel and keep only the colours present.
  const lookup = new Map()
  const palette = []
  for (let i = 0; i < size * size; i++) {
    const key = (rgb[i * 3] >> 3) * 1024 + (rgb[i * 3 + 1] >> 3) * 32 + (rgb[i * 3 + 2] >> 3)
    if (!lookup.has(key)) {
      if (palette.length >= 256) throw new Error('palette overflow: >256 colours')
      lookup.set(key, palette.length)
      palette.push([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]])
    }
  }

  const plte = Buffer.alloc(palette.length * 3)
  palette.forEach((c, i) => {
    plte[i * 3] = c[0]
    plte[i * 3 + 1] = c[1]
    plte[i * 3 + 2] = c[2]
  })

  // Filter type 1 (Sub) per scanline: neighbouring pixels are nearly identical
  // along a gradient, so the deltas are small and deflate does well.
  const stride = size + 1
  const raw = Buffer.alloc(size * stride)
  for (let y = 0; y < size; y++) {
    const o = y * stride
    raw[o] = 1
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const cur = lookup.get((rgb[i * 3] >> 3) * 1024 + (rgb[i * 3 + 1] >> 3) * 32 + (rgb[i * 3 + 2] >> 3))
      const left = x > 0 ? lookup.get((rgb[i * 3 - 3] >> 3) * 1024 + (rgb[i * 3 - 2] >> 3) * 32 + (rgb[i * 3 - 1] >> 3)) : 0
      raw[o + 1 + x] = (cur - left) & 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 3 // colour type: indexed
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Run ──────────────────────────────────────────────────────────────────────
mkdirSync('public/icons', { recursive: true })
for (const { name, size, markWidth } of OUTPUTS) {
  const png = encodePng(size, rasterise(size, markWidth))
  writeFileSync(`public/icons/${name}.png`, png)
  console.log(`${name}.png  ${size}×${size}  ${png.length} bytes`)
}
