/**
 * 2D-canvas renderer for a "WIN" energy border around a BetSpot.
 *
 * The look is a clean neon ring hugging a rounded rectangle: a bright core tube
 * traces the exact outline (no jitter, so the border stays straight). Bright
 * energy clusters travel continuously around the loop in one direction, only
 * brightening the ring as they sweep past, so it reads as a steady rotation
 * rather than an oscillating wave or a single comet.
 *
 * The outline is sampled into points once on resize; each frame we additively
 * stack strokes (wide glow -> mid -> white-hot core) along it, so it reads as
 * neon without any per-segment shadow blur.
 *
 * The canvas extends a margin beyond the card so the radiating energy isn't
 * clipped.
 */

export type BetSpotLightningOptions = {
  /** Card width in CSS pixels (the box the border hugs). */
  cardWidth: number
  /** Card height in CSS pixels. */
  cardHeight: number
  /** Corner radius of the card in CSS pixels. */
  radius: number
  /** Transparent breathing room around the card for the glow, in CSS pixels. */
  margin: number
  /** Device pixel ratio. */
  pixelRatio: number
}

type Point = readonly [number, number]

const SPACING_PX = 3 // perimeter sample spacing
const BASE_BRIGHTNESS = 0.85 // the ring stays lit; the flow only adds brightness on top
const CORE_WIDTH = 3 // bright neon core tube thickness, CSS px

const FLOW_PERIOD_S = 2.4 // seconds for the energy to travel once around the ring
const FLOW_CLUSTERS = 5 // number of bright energy clusters spaced around the loop
const TWO_PI = Math.PI * 2

export class BetSpotLightningBorder {
  private readonly ctx: CanvasRenderingContext2D
  private points: Point[] = []
  private normals: Point[] = []
  private cum: number[] = []
  private total = 0
  private cx = 0
  private cy = 0
  private basePath: Path2D = new Path2D()
  private dpr = 1
  private cssWidth = 0
  private cssHeight = 0
  private rafId = 0
  private startTime = 0
  private running = false

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context is not available')
    this.ctx = ctx
  }

  /** Re-measure the outline for a new card size / DPR. */
  resize(opts: BetSpotLightningOptions): void {
    const { cardWidth, cardHeight, margin, pixelRatio } = opts
    const radius = Math.min(opts.radius, Math.min(cardWidth, cardHeight) / 2)

    this.dpr = pixelRatio
    this.cssWidth = cardWidth + margin * 2
    this.cssHeight = cardHeight + margin * 2

    const canvas = this.ctx.canvas
    const w = Math.max(1, Math.round(this.cssWidth * pixelRatio))
    const h = Math.max(1, Math.round(this.cssHeight * pixelRatio))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    const ox = margin
    const oy = margin
    this.buildOutline(ox, oy, cardWidth, cardHeight, radius)
    this.buildBasePath(ox, oy, cardWidth, cardHeight, radius)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.startTime = performance.now()
    const loop = (now: number): void => {
      if (!this.running) return
      this.renderFrame((now - this.startTime) / 1000)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    this.clear()
  }

  dispose(): void {
    this.stop()
  }

  private clear(): void {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight)
  }

  /** Sample the rounded-rectangle perimeter into clockwise-ordered points. */
  private buildOutline(ox: number, oy: number, w: number, h: number, r: number): void {
    const cx = ox + w / 2
    const cy = oy + h / 2
    this.cx = cx
    this.cy = cy
    const pts: Point[] = []

    const line = (x0: number, y0: number, x1: number, y1: number): void => {
      const len = Math.hypot(x1 - x0, y1 - y0)
      const n = Math.max(1, Math.ceil(len / SPACING_PX))
      for (let i = 0; i < n; i++) {
        const f = i / n
        pts.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f])
      }
    }
    const arc = (acx: number, acy: number, start: number, end: number): void => {
      const len = Math.abs(end - start) * r
      const n = Math.max(2, Math.ceil(len / SPACING_PX))
      for (let i = 0; i < n; i++) {
        const a = start + (end - start) * (i / n)
        pts.push([acx + Math.cos(a) * r, acy + Math.sin(a) * r])
      }
    }

    // Clockwise (in canvas y-down space): top L->R, right T->B, bottom R->L, left B->T.
    // Advancing along this array reads as clockwise on screen.
    line(ox + r, oy, ox + w - r, oy)
    arc(ox + w - r, oy + r, -Math.PI / 2, 0)
    line(ox + w, oy + r, ox + w, oy + h - r)
    arc(ox + w - r, oy + h - r, 0, Math.PI / 2)
    line(ox + w - r, oy + h, ox + r, oy + h)
    arc(ox + r, oy + h - r, Math.PI / 2, Math.PI)
    line(ox, oy + h - r, ox, oy + r)
    arc(ox + r, oy + r, Math.PI, Math.PI * 1.5)

    const count = pts.length
    const normals: Point[] = new Array(count)
    const cum: number[] = new Array(count)
    let acc = 0
    for (let i = 0; i < count; i++) {
      const prev = pts[(i - 1 + count) % count]
      const next = pts[(i + 1) % count]
      const tx = next[0] - prev[0]
      const ty = next[1] - prev[1]
      let nx = ty
      let ny = -tx
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl
      ny /= nl
      // Orient outward (away from the card centre).
      if ((pts[i][0] - cx) * nx + (pts[i][1] - cy) * ny < 0) {
        nx = -nx
        ny = -ny
      }
      normals[i] = [nx, ny]
      cum[i] = acc
      acc += Math.hypot(pts[i][0] - pts[(i + 1) % count][0], pts[i][1] - pts[(i + 1) % count][1])
    }

    this.points = pts
    this.normals = normals
    this.cum = cum
    this.total = acc
  }

  private buildBasePath(ox: number, oy: number, w: number, h: number, r: number): void {
    const p = new Path2D()
    p.moveTo(ox + r, oy)
    p.lineTo(ox + w - r, oy)
    p.arcTo(ox + w, oy, ox + w, oy + r, r)
    p.lineTo(ox + w, oy + h - r)
    p.arcTo(ox + w, oy + h, ox + w - r, oy + h, r)
    p.lineTo(ox + r, oy + h)
    p.arcTo(ox, oy + h, ox, oy + h - r, r)
    p.lineTo(ox, oy + r)
    p.arcTo(ox, oy, ox + r, oy, r)
    p.closePath()
    this.basePath = p
  }

  private seg(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    style: string,
  ): void {
    const { ctx } = this
    ctx.lineWidth = width
    ctx.strokeStyle = style
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }

  /**
   * Energy travelling around the loop: bright clusters that all rotate in one
   * direction at a constant rate (continuous circular motion, not a wave). For a
   * point at perimeter fraction `frac`, the pattern shifts a full lap every
   * FLOW_PERIOD_S seconds. Returns ~0..1.
   */
  private flow(frac: number, t: number): number {
    const phase = TWO_PI * FLOW_CLUSTERS * (frac - t / FLOW_PERIOD_S)
    return 0.5 + 0.5 * Math.cos(phase)
  }

  private renderFrame(t: number): void {
    const { ctx, points, cum, total } = this
    if (points.length === 0 || total === 0) return

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const count = points.length

    // The neon core ring follows the exact outline (no jitter) so it stays a clean,
    // straight rounded rectangle; the travelling flow only brightens it as it sweeps
    // past, so the ring reads as rotating rather than waving.
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count
      const flow = this.flow(cum[i] / total, t)
      const b = BASE_BRIGHTNESS * (0.7 + 0.3 * flow)
      const x0 = points[i][0]
      const y0 = points[i][1]
      const x1 = points[j][0]
      const y1 = points[j][1]

      this.seg(x0, y0, x1, y1, CORE_WIDTH * 4.5, `rgba(150, 70, 255, ${0.08 * b})`)
      this.seg(x0, y0, x1, y1, CORE_WIDTH * 2.1, `rgba(214, 120, 255, ${0.5 * b})`)
      this.seg(x0, y0, x1, y1, CORE_WIDTH, `rgba(255, 244, 255, ${Math.min(1, b)})`)
    }
  }
}
