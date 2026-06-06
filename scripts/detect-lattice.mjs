/**
 * Estimate the translational repeat lattice of a path field by reading the
 * generated *Data.ts module, extracting all absolute coordinates, and scoring
 * how well the point cloud maps onto itself under candidate shift vectors.
 *
 * Usage: node scripts/detect-lattice.mjs <path-to-Data.ts> <EXPORT_PREFIX>
 */
import fs from 'node:fs'

const [file, prefix = 'CANVAS_ARTWORK_TIGER'] = process.argv.slice(2)
const src = fs.readFileSync(file, 'utf8')

// Reconstruct the joined `d` string from the D.push(`...`) chunks.
const chunks = [...src.matchAll(/D\.push\(`([\s\S]*?)`\)/g)].map((m) => m[1])
const d = chunks.join('')
if (!d) {
  console.error('no path chunks found')
  process.exit(1)
}

// Parse absolute on-path points (M/L/C endpoints, H/V), tracking current point.
const TOKEN = /([astvzqmhlcASTVZQMHLC])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g
const COUNT = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 }
const toks = []
let mm
while ((mm = TOKEN.exec(d))) toks.push(mm[1] ? { c: mm[1] } : { n: parseFloat(mm[2]) })

const pts = []
let cx = 0
let cy = 0
let sx = 0
let sy = 0
let cmd = ''
let i = 0
const num = () => {
  const t = toks[i]
  i++
  return t && t.n !== undefined ? t.n : 0
}
while (i < toks.length) {
  const t = toks[i]
  if (t.c !== undefined) {
    cmd = t.c
    i++
    if (cmd === 'Z' || cmd === 'z') {
      cx = sx
      cy = sy
      continue
    }
  } else {
    if (cmd === 'M') cmd = 'L'
    else if (cmd === 'm') cmd = 'l'
    if (!cmd) {
      i++
      continue
    }
  }
  const lc = cmd.toLowerCase()
  const rel = cmd === lc
  const n = COUNT[lc] ?? 0
  if (n === 0) continue
  const a = []
  for (let k = 0; k < n; k++) a.push(num())
  let x = cx
  let y = cy
  if (lc === 'h') x = rel ? cx + a[0] : a[0]
  else if (lc === 'v') y = rel ? cy + a[0] : a[0]
  else {
    x = rel ? cx + a[n - 2] : a[n - 2]
    y = rel ? cy + a[n - 1] : a[n - 1]
  }
  if (lc === 'm') {
    sx = x
    sy = y
  }
  cx = x
  cy = y
  pts.push([x, y])
}

const xs = pts.map((p) => p[0])
const ys = pts.map((p) => p[1])
const bbox = {
  minX: Math.min(...xs),
  maxX: Math.max(...xs),
  minY: Math.min(...ys),
  maxY: Math.max(...ys),
}
console.log(`points: ${pts.length}`)
console.log(
  `bbox: x[${bbox.minX.toFixed(1)}, ${bbox.maxX.toFixed(1)}] y[${bbox.minY.toFixed(1)}, ${bbox.maxY.toFixed(1)}]`,
)

// Spatial hash for fast nearest-match lookups.
const TOL = 2.5
const cell = TOL
const key = (x, y) => `${Math.round(x / cell)},${Math.round(y / cell)}`
const grid = new Map()
for (const [x, y] of pts) {
  const k = key(x, y)
  if (!grid.has(k)) grid.set(k, [])
  grid.get(k).push([x, y])
}
const hasNear = (x, y) => {
  const gx = Math.round(x / cell)
  const gy = Math.round(y / cell)
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const arr = grid.get(`${gx + dx},${gy + dy}`)
      if (!arr) continue
      for (const [px, py] of arr) {
        if (Math.abs(px - x) <= TOL && Math.abs(py - y) <= TOL) return true
      }
    }
  return false
}

// Score a shift vector: fraction of interior points whose shifted copy also
// lands on a point (only count points whose shifted position stays in bbox).
const score = (vx, vy) => {
  let inside = 0
  let hit = 0
  for (const [x, y] of pts) {
    const nx = x + vx
    const ny = y + vy
    if (nx < bbox.minX || nx > bbox.maxX || ny < bbox.minY || ny > bbox.maxY) continue
    inside++
    if (hasNear(nx, ny)) hit++
  }
  return inside > 50 ? hit / inside : 0
}

// Horizontal period scan.
let bestH = { p: 0, s: 0 }
for (let p = 60; p <= 280; p += 0.5) {
  const s = score(p, 0)
  if (s > bestH.s) bestH = { p, s }
}
console.log(`best horizontal period: ${bestH.p.toFixed(1)} (score ${bestH.s.toFixed(3)})`)

// Half-drop / row vector scan around the horizontal period.
let bestRow = { sx: 0, sy: 0, s: 0 }
for (let ry = 60; ry <= 200; ry += 1) {
  for (let rx = -bestH.p; rx <= bestH.p; rx += 1) {
    const s = score(rx, ry)
    if (s > bestRow.s) bestRow = { sx: rx, sy: ry, s }
  }
}
console.log(
  `best row vector: (${bestRow.sx.toFixed(1)}, ${bestRow.sy.toFixed(1)}) score ${bestRow.s.toFixed(3)}`,
)
console.log(`prefix: ${prefix}`)
