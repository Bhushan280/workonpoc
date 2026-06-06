/**
 * Pure-Canvas renderer for a single compound-path artwork.
 *
 * Unlike a generic SVG engine, this never touches the DOM or `DOMParser`: the
 * geometry is a `Path2D` built once from a `d` string. The motif repeats to fill
 * any canvas size, while a single gradient is painted continuously across the
 * whole surface (not per tile), so the colour sweep stays the same everywhere.
 *
 * Tiling follows the artwork's real lattice. Many decorative fields (this leaf
 * pattern included) are *half-drop*: each row is shifted sideways by a fixed
 * amount (`rowShear`). Stamping a naive rectangle of the SVG `viewBox` ignores
 * that shear and the tiles visibly fail to line up, so the renderer crops one
 * lattice cell and applies the shear per row instead.
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
   * One repeating lattice cell, cropped from the periodic interior of the
   * artwork (in viewBox units). Defaults to the full `viewBox`.
   */
  tile?: ViewBox
  /**
   * Horizontal shift applied per row going downward, in viewBox units. `0` is a
   * plain rectangular grid; for a half-drop pattern this is ~half the tile
   * width so successive rows interlock seamlessly.
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
  /** CSS pixels per viewBox unit — controls the repeat (tile) size. */
  tileScale?: number
}

interface ResolvedDrawOptions {
  pixelRatio: number
  background: string | null
  panX: number
  panY: number
  tileScale: number
}

interface MotifCache {
  key: string
  canvas: HTMLCanvasElement
  width: number
  height: number
}

export class CanvasArtworkDragonRenderer {
  private readonly spec: CanvasArtworkSpecDragon
  private readonly path: Path2D
  private motif: MotifCache | null = null

  constructor(spec: CanvasArtworkSpecDragon) {
    if (typeof Path2D === 'undefined') {
      throw new Error('Path2D is not available in this environment')
    }
    this.spec = spec
    this.path = new Path2D(spec.pathData)
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

  private get tileWindow(): ViewBox {
    return this.spec.tile ?? this.viewBox
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

  /**
   * Stamp the lattice cell across the buffer (with per-row half-drop shear),
   * then paint one canvas-wide gradient through it. The geometry repeats and
   * interlocks; the gradient does not repeat.
   */
  private renderField(
    ctx: CanvasRenderingContext2D,
    bufferW: number,
    bufferH: number,
    opts: ResolvedDrawOptions,
  ): void {
    const motif = this.getMotif(opts)
    const tileW = motif.width
    const tileH = motif.height
    const pxPerUnit = opts.tileScale * opts.pixelRatio
    const shear = (this.spec.rowShear ?? 0) * pxPerUnit

    const layer = document.createElement('canvas')
    layer.width = bufferW
    layer.height = bufferH
    const lctx = layer.getContext('2d')
    if (!lctx) throw new Error('Could not acquire a 2D context for the field layer')

    // Centre the grid so the field stays symmetric about the canvas, then pan.
    const originX = (bufferW - tileW) / 2 + opts.panX * opts.pixelRatio
    const originY = (bufferH - tileH) / 2 + opts.panY * opts.pixelRatio

    const startRow = Math.floor((0 - originY) / tileH) - 1
    const endRow = Math.ceil((bufferH - originY) / tileH) + 1

    for (let row = startRow; row < endRow; row++) {
      const y = Math.round(originY + row * tileH)
      const rowX = originX + row * shear
      const startCol = Math.floor((0 - rowX) / tileW) - 1
      const endCol = Math.ceil((bufferW - rowX) / tileW) + 1
      for (let col = startCol; col < endCol; col++) {
        lctx.drawImage(motif.canvas, Math.round(rowX + col * tileW), y, tileW, tileH)
      }
    }

    // Keep the gradient only where the repeated motif is opaque.
    lctx.globalCompositeOperation = 'source-in'
    lctx.fillStyle = this.buildGradient(lctx, bufferW, bufferH)
    lctx.fillRect(0, 0, bufferW, bufferH)

    ctx.drawImage(layer, 0, 0)
  }

  /**
   * Rasterise one lattice cell as an opaque silhouette (alpha only matters).
   * The cell is cropped from the periodic interior of the artwork, so abutting
   * copies — including the half-drop neighbours — continue each other exactly.
   */
  private getMotif(opts: ResolvedDrawOptions): MotifCache {
    const win = this.tileWindow
    const pxPerUnit = opts.tileScale * opts.pixelRatio
    const tileW = Math.max(1, Math.round(win.width * pxPerUnit))
    const tileH = Math.max(1, Math.round(win.height * pxPerUnit))
    const key = `${tileW}x${tileH}`

    if (this.motif?.key === key) return this.motif

    const canvas = document.createElement('canvas')
    canvas.width = tileW
    canvas.height = tileH
    const tctx = canvas.getContext('2d')
    if (!tctx) throw new Error('Could not acquire a 2D context for the motif')

    tctx.setTransform(1, 0, 0, 1, 0, 0)
    tctx.clearRect(0, 0, tileW, tileH)
    tctx.scale(tileW / win.width, tileH / win.height)
    tctx.translate(-win.x, -win.y)
    tctx.fillStyle = '#000'
    tctx.fill(this.path, this.spec.fillRule ?? 'nonzero')

    this.motif = { key, canvas, width: tileW, height: tileH }
    return this.motif
  }

  /**
   * One linear gradient spanning the whole canvas, mapped from the artwork's
   * user-space axis. The vertical brand gradient runs top→bottom across the
   * full height regardless of how many tiles are visible.
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
