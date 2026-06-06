/**
 * Pure-Canvas renderer for a single compound-path artwork.
 *
 * The pattern is drawn *continuously* as vector geometry: the `Path2D` is filled
 * directly onto the canvas under a per-copy transform for every lattice point
 * that overlaps the buffer. There is no pre-rasterised tile and no `drawImage`
 * stamping, so there are no bitmap seams, no per-tile rounding, and the field
 * stays pixel-crisp at any size.
 *
 * The field is described by its translational lattice. For a half-drop pattern
 * the row vector is sheared sideways (`rowShear`). Because the source path spans
 * several lattice cells, neighbouring copies overlap and their union covers the
 * whole surface with no gaps. A single gradient is painted across the entire
 * canvas (not per copy) via `source-in`, so the colour sweep is continuous.
 *
 * Symmetry: the lattice is anchored on the path's bounding-box centre, which is
 * pinned to the canvas centre. Growing the canvas in any direction therefore
 * expands the field symmetrically about the middle.
 */

export interface GradientStop {
  /** 0..1 position along the gradient axis. */
  offset: number
  color: string
}

/** A linear gradient in the artwork's own (user-space) coordinates. */
export interface LinearGradientSpec {
  x1: number
  y1: number
  x2: number
  y2: number
  stops: GradientStop[]
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasArtworkSpecDragon {
  /** Source coordinate window (the SVG `viewBox`). */
  viewBox: ViewBox
  /** The compound path's `d` attribute. */
  pathData: string
  /** Fill rule for the compound path (Figma exports use `nonzero`). */
  fillRule?: CanvasFillRule
  gradient: LinearGradientSpec
  /**
   * Repeating lattice cell, in viewBox units. Only `width` (horizontal period)
   * and `height` (row pitch) are used; defaults to the full `viewBox`.
   */
  tile?: ViewBox
  /**
   * Horizontal shift applied per row going downward, in viewBox units. `0` is a
   * plain rectangular grid; for a half-drop pattern this is half the period so
   * successive rows interlock seamlessly.
   */
  rowShear?: number
}

export interface DrawOptions {
  /** Device-pixel multiplier for the backing buffer. Defaults to DPR. */
  pixelRatio?: number
  /** Solid background painted before the artwork. `null` keeps transparency. */
  background?: string | null
  /** Pan offset in CSS pixels — scrolls the repeated field. */
  panX?: number
  panY?: number
  /** CSS pixels per viewBox unit — controls the repeat size. */
  tileScale?: number
}

interface ResolvedDrawOptions {
  pixelRatio: number
  background: string | null
  panX: number
  panY: number
  tileScale: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export class CanvasArtworkDragonRenderer {
  private readonly spec: CanvasArtworkSpecDragon
  private readonly path: Path2D
  private readonly bounds: Bounds

  constructor(spec: CanvasArtworkSpecDragon) {
    if (typeof Path2D === 'undefined') {
      throw new Error('Path2D is not available in this environment')
    }
    this.spec = spec
    this.path = new Path2D(spec.pathData)
    this.bounds = this.resolveBounds(spec)
  }

  /** Resize the canvas buffer to its CSS box and paint the repeated field. */
  draw(canvas: HTMLCanvasElement, options: DrawOptions = {}): void {
    const opts = this.resolveOptions(options)

    const cssWidth = canvas.clientWidth || this.viewBox.width
    const cssHeight = canvas.clientHeight || this.viewBox.height
    const bufferW = Math.max(1, Math.round(cssWidth * opts.pixelRatio))
    const bufferH = Math.max(1, Math.round(cssHeight * opts.pixelRatio))
    if (canvas.width !== bufferW) canvas.width = bufferW
    if (canvas.height !== bufferH) canvas.height = bufferH

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not acquire a 2D context')

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, bufferW, bufferH)
    if (opts.background) {
      ctx.fillStyle = opts.background
      ctx.fillRect(0, 0, bufferW, bufferH)
    }

    this.renderField(ctx, bufferW, bufferH, opts)
  }

  private get viewBox(): ViewBox {
    return this.spec.viewBox
  }

  private resolveOptions(options: DrawOptions): ResolvedDrawOptions {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    return {
      pixelRatio: Math.max(0.1, options.pixelRatio ?? dpr),
      background: options.background ?? null,
      panX: options.panX ?? 0,
      panY: options.panY ?? 0,
      tileScale: Math.max(0.05, options.tileScale ?? 1),
    }
  }

  private resolveBounds(spec: CanvasArtworkSpecDragon): Bounds {
    const parsed = computePathBounds(spec.pathData)
    if (parsed && Number.isFinite(parsed.minX) && parsed.maxX > parsed.minX) {
      return parsed
    }
    const vb = spec.viewBox
    return { minX: vb.x, minY: vb.y, maxX: vb.x + vb.width, maxY: vb.y + vb.height }
  }

  /**
   * Fill the vector path once per lattice point that overlaps the buffer, then
   * paint one canvas-wide gradient through the union. Copies overlap (the path
   * spans several cells), so the field is gap-free and continuous.
   */
  private renderField(
    ctx: CanvasRenderingContext2D,
    bufferW: number,
    bufferH: number,
    opts: ResolvedDrawOptions,
  ): void {
    const pxPerUnit = opts.tileScale * opts.pixelRatio

    const period = (this.spec.tile?.width ?? this.viewBox.width)
    const rowPitch = (this.spec.tile?.height ?? this.viewBox.height)
    const shear = this.spec.rowShear ?? 0

    // Lattice vectors in device pixels: v1 along the row, v2 to the next row.
    const v1x = period * pxPerUnit
    const v2x = shear * pxPerUnit
    const v2y = rowPitch * pxPerUnit
    if (v1x <= 0 || v2y <= 0) return

    const layer = document.createElement('canvas')
    layer.width = bufferW
    layer.height = bufferH
    const lctx = layer.getContext('2d')
    if (!lctx) throw new Error('Could not acquire a 2D context for the field layer')

    // Pin the path bbox centre to the canvas centre so growth stays symmetric.
    const b = this.bounds
    const centreX = (b.minX + b.maxX) / 2
    const centreY = (b.minY + b.maxY) / 2
    const e0 = bufferW / 2 + opts.panX * opts.pixelRatio - centreX * pxPerUnit
    const f0 = bufferH / 2 + opts.panY * opts.pixelRatio - centreY * pxPerUnit

    // A copy at lattice (i, j) paints the device box offset by these margins.
    const minXpx = b.minX * pxPerUnit
    const maxXpx = b.maxX * pxPerUnit
    const minYpx = b.minY * pxPerUnit
    const maxYpx = b.maxY * pxPerUnit

    const jStart = Math.floor((-f0 - maxYpx) / v2y) - 1
    const jEnd = Math.ceil((bufferH - f0 - minYpx) / v2y) + 1

    lctx.fillStyle = '#000'
    const fillRule = this.spec.fillRule ?? 'nonzero'

    for (let j = jStart; j <= jEnd; j++) {
      const rowOffsetX = e0 + j * v2x
      const f = f0 + j * v2y
      const iStart = Math.floor((-rowOffsetX - maxXpx) / v1x) - 1
      const iEnd = Math.ceil((bufferW - rowOffsetX - minXpx) / v1x) + 1
      for (let i = iStart; i <= iEnd; i++) {
        const e = rowOffsetX + i * v1x
        lctx.setTransform(pxPerUnit, 0, 0, pxPerUnit, e, f)
        lctx.fill(this.path, fillRule)
      }
    }

    // Keep the gradient only where the repeated motif is opaque.
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.globalCompositeOperation = 'source-in'
    lctx.fillStyle = this.buildGradient(lctx, bufferW, bufferH)
    lctx.fillRect(0, 0, bufferW, bufferH)

    ctx.drawImage(layer, 0, 0)
  }

  /**
   * One linear gradient spanning the whole canvas, mapped from the artwork's
   * user-space axis. The vertical brand gradient runs top→bottom across the
   * full height regardless of how much of the field is visible.
   */
  private buildGradient(
    ctx: CanvasRenderingContext2D,
    bufferW: number,
    bufferH: number,
  ): CanvasGradient {
    const { width: vbW, height: vbH } = this.viewBox
    const g = this.spec.gradient
    const sx = bufferW / vbW
    const sy = bufferH / vbH
    const gradient = ctx.createLinearGradient(g.x1 * sx, g.y1 * sy, g.x2 * sx, g.y2 * sy)
    for (const stop of g.stops) {
      gradient.addColorStop(clamp01(stop.offset), stop.color)
    }
    return gradient
  }
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
const PATH_TOKEN = /([astvzqmhlcASTVZQMHLC])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g
const ARG_COUNT: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
}

/**
 * Approximate bounding box of a path `d` string, including bezier control
 * points (so the box is an over-estimate — safe for coverage margins). Walks
 * the commands so `H`/`V` and relative commands are handled correctly.
 */
function computePathBounds(d: string): Bounds | null {
  const numbers: Array<{ c?: string; n?: number }> = []
  let match: RegExpExecArray | null
  PATH_TOKEN.lastIndex = 0
  while ((match = PATH_TOKEN.exec(d))) {
    numbers.push(match[1] ? { c: match[1] } : { n: parseFloat(match[2]) })
  }
  if (numbers.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const ext = (x: number, y: number): void => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let cmd = ''
  let idx = 0

  const nextNum = (): number => {
    const tok = numbers[idx]
    idx++
    return tok && tok.n !== undefined ? tok.n : 0
  }

  while (idx < numbers.length) {
    const tok = numbers[idx]
    if (tok.c !== undefined) {
      cmd = tok.c
      idx++
      if (cmd === 'Z' || cmd === 'z') {
        cx = startX
        cy = startY
        continue
      }
    } else {
      // Implicit repeat of the previous command; M/m repeats as a line.
      if (cmd === 'M') cmd = 'L'
      else if (cmd === 'm') cmd = 'l'
      if (cmd === '') {
        idx++
        continue
      }
    }

    const lc = cmd.toLowerCase()
    const rel = cmd === lc
    const count = ARG_COUNT[lc] ?? 0
    if (count === 0) continue

    const a: number[] = []
    for (let k = 0; k < count; k++) a.push(nextNum())

    switch (lc) {
      case 'm':
      case 'l':
      case 't': {
        const x = rel ? cx + a[0] : a[0]
        const y = rel ? cy + a[1] : a[1]
        ext(x, y)
        cx = x
        cy = y
        if (lc === 'm') {
          startX = x
          startY = y
        }
        break
      }
      case 'h': {
        const x = rel ? cx + a[0] : a[0]
        ext(x, cy)
        cx = x
        break
      }
      case 'v': {
        const y = rel ? cy + a[0] : a[0]
        ext(cx, y)
        cy = y
        break
      }
      case 'c': {
        const x1 = rel ? cx + a[0] : a[0]
        const y1 = rel ? cy + a[1] : a[1]
        const x2 = rel ? cx + a[2] : a[2]
        const y2 = rel ? cy + a[3] : a[3]
        const x = rel ? cx + a[4] : a[4]
        const y = rel ? cy + a[5] : a[5]
        ext(x1, y1)
        ext(x2, y2)
        ext(x, y)
        cx = x
        cy = y
        break
      }
      case 's':
      case 'q': {
        const x1 = rel ? cx + a[0] : a[0]
        const y1 = rel ? cy + a[1] : a[1]
        const x = rel ? cx + a[2] : a[2]
        const y = rel ? cy + a[3] : a[3]
        ext(x1, y1)
        ext(x, y)
        cx = x
        cy = y
        break
      }
      case 'a': {
        const x = rel ? cx + a[5] : a[5]
        const y = rel ? cy + a[6] : a[6]
        ext(x, y)
        cx = x
        cy = y
        break
      }
      default:
        break
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null
  return { minX, minY, maxX, maxY }
}

