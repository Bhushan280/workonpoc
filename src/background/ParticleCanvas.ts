/**
 * ParticleCanvas — an animated ambient particle field for the whole app
 * background.
 *
 * One full-viewport `<canvas>` painted black, with particles drifting across it.
 * The behaviour (colour, speed, density, glow, motion pattern, direction and
 * pointer interaction) is driven entirely by a {@link ParticleTheme}. Calling
 * {@link ParticleCanvas.setTheme} morphs the field from its current look to the
 * new one — numeric parameters ease over time, per-particle colours cross-fade,
 * velocities relax toward the new motion pattern and the population grows/shrinks
 * to the new density — so switching lab experiments feels like one living layer
 * reacting, not a hard cut.
 */

import type { ParticleTheme } from './particleThemes'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  phase: number
  seed: number
  // Current colour, eased toward the target colour on theme changes.
  r: number
  g: number
  b: number
  tr: number
  tg: number
  tb: number
}

/** Numeric fields of a theme that we smoothly interpolate frame to frame. */
type LiveParams = {
  speed: number
  glow: number
  sway: number
  turbulence: number
  pointerRadius: number
  pointerForce: number
  trail: number
  connectDistance: number
  direction: number
}

const MAX_PARTICLES = 240
const THEME_EASE_TAU = 0.45 // seconds — how quickly live params chase the target
const COLOR_EASE = 2.5 // per-second colour cross-fade rate
const VELOCITY_EASE = 1.8 // per-second velocity relaxation toward the motion target

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pick<T>(items: readonly T[]): T {
  return items[(Math.random() * items.length) | 0]
}

function expEase(current: number, target: number, dt: number, tau: number): number {
  const k = 1 - Math.exp(-dt / tau)
  return current + (target - current) * k
}

export class ParticleCanvas {
  private readonly ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private theme: ParticleTheme
  private live: LiveParams
  private dpr = 1
  private cssW = 0
  private cssH = 0
  private rafId = 0
  private lastT = 0
  private running = false

  private pointerX = 0
  private pointerY = 0
  private pointerActive = false

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.pointerX = e.clientX
    this.pointerY = e.clientY
    this.pointerActive = true
  }
  private readonly onPointerLeave = (): void => {
    this.pointerActive = false
  }

  constructor(canvas: HTMLCanvasElement, theme: ParticleTheme) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context is not available')
    this.ctx = ctx
    this.theme = theme
    this.live = ParticleCanvas.liveFromTheme(theme)
  }

  private static liveFromTheme(t: ParticleTheme): LiveParams {
    return {
      speed: t.speed,
      glow: t.glow,
      sway: t.sway,
      turbulence: t.turbulence,
      pointerRadius: t.pointerRadius,
      pointerForce: t.pointerForce,
      trail: t.trail,
      connectDistance: t.connectDistance,
      direction: t.direction,
    }
  }

  /** Swap to a new theme; the field morphs toward it over the next ~second. */
  setTheme(theme: ParticleTheme): void {
    this.theme = theme
    // Retarget colours for a cross-fade and reconcile the population to the new density.
    for (const p of this.particles) {
      const [tr, tg, tb] = pick(theme.colors)
      p.tr = tr
      p.tg = tg
      p.tb = tb
    }
    this.reconcilePopulation()
  }

  /** Re-measure the viewport and rebuild the particle population for the new area. */
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    this.cssW = Math.max(1, cssWidth)
    this.cssH = Math.max(1, cssHeight)
    this.dpr = pixelRatio
    const canvas = this.ctx.canvas
    canvas.width = Math.round(this.cssW * this.dpr)
    canvas.height = Math.round(this.cssH * this.dpr)
    this.reconcilePopulation()
  }

  private targetCount(): number {
    const area = this.cssW * this.cssH
    const n = Math.round((this.theme.density * area) / 100000)
    return Math.max(24, Math.min(MAX_PARTICLES, n))
  }

  private spawn(immediateColor: boolean): Particle {
    const [tr, tg, tb] = pick(this.theme.colors)
    return {
      x: rand(0, this.cssW),
      y: rand(0, this.cssH),
      vx: 0,
      vy: 0,
      size: rand(this.theme.size[0], this.theme.size[1]),
      alpha: rand(this.theme.alpha[0], this.theme.alpha[1]),
      phase: rand(0, Math.PI * 2),
      seed: rand(0, 1000),
      r: immediateColor ? tr : 6,
      g: immediateColor ? tg : 6,
      b: immediateColor ? tb : 10,
      tr,
      tg,
      tb,
    }
  }

  private reconcilePopulation(): void {
    if (this.cssW === 0 || this.cssH === 0) return
    const want = this.targetCount()
    const have = this.particles.length
    if (want > have) {
      const seedColor = have === 0 // first fill: start at final colour, no fade-in from black
      for (let i = have; i < want; i++) this.particles.push(this.spawn(seedColor))
    } else if (want < have) {
      this.particles.length = want
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastT = performance.now()
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    const loop = (now: number): void => {
      if (!this.running) return
      const dt = Math.min(0.05, (now - this.lastT) / 1000)
      this.lastT = now
      this.tick(dt, now / 1000)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerleave', this.onPointerLeave)
  }

  dispose(): void {
    this.stop()
    this.particles = []
  }

  /** Ease the live numeric params toward the current theme's targets. */
  private easeLive(dt: number): void {
    const t = this.theme
    const L = this.live
    L.speed = expEase(L.speed, t.speed, dt, THEME_EASE_TAU)
    L.glow = expEase(L.glow, t.glow, dt, THEME_EASE_TAU)
    L.sway = expEase(L.sway, t.sway, dt, THEME_EASE_TAU)
    L.turbulence = expEase(L.turbulence, t.turbulence, dt, THEME_EASE_TAU)
    L.pointerRadius = expEase(L.pointerRadius, t.pointerRadius, dt, THEME_EASE_TAU)
    L.pointerForce = expEase(L.pointerForce, t.pointerForce, dt, THEME_EASE_TAU)
    L.trail = expEase(L.trail, t.trail, dt, THEME_EASE_TAU)
    L.connectDistance = expEase(L.connectDistance, t.connectDistance, dt, THEME_EASE_TAU)
    L.direction = expEase(L.direction, t.direction, dt, THEME_EASE_TAU)
  }

  /** Desired velocity for a particle under the active motion pattern. */
  private desiredVelocity(p: Particle, time: number, out: { x: number; y: number }): void {
    const { speed, sway, direction } = this.live
    switch (this.theme.motion) {
      case 'rise': {
        out.x = Math.sin(time * 0.6 + p.phase) * sway
        out.y = -speed
        break
      }
      case 'swirl': {
        const cx = this.cssW / 2
        const cy = this.cssH / 2
        const dx = p.x - cx
        const dy = p.y - cy
        const len = Math.hypot(dx, dy) || 1
        // Tangential spin with a gentle inward pull so motes orbit the centre.
        out.x = (-dy / len) * speed - (dx / len) * speed * 0.12
        out.y = (dx / len) * speed - (dy / len) * speed * 0.12
        break
      }
      case 'wander': {
        const a = Math.sin(p.seed + time * 0.5) * Math.PI
        out.x = Math.cos(a) * speed
        out.y = Math.sin(a) * speed
        break
      }
      case 'stream': {
        // Mostly one direction, with per-particle speed variance for gusty streaks.
        const v = speed * (0.6 + (p.seed % 1))
        out.x = Math.cos(direction) * v
        out.y = Math.sin(direction) * v
        break
      }
      case 'drift':
      default: {
        out.x = Math.cos(direction) * speed
        out.y = Math.sin(direction) * speed
        break
      }
    }
  }

  private applyPointer(p: Particle, dt: number): void {
    if (!this.pointerActive || this.theme.pointer === 'none') return
    const dx = p.x - this.pointerX
    const dy = p.y - this.pointerY
    const dist = Math.hypot(dx, dy)
    const radius = this.live.pointerRadius
    if (dist >= radius || dist === 0) return
    const falloff = 1 - dist / radius
    const force = this.live.pointerForce * falloff * dt
    const nx = dx / dist
    const ny = dy / dist
    switch (this.theme.pointer) {
      case 'repel':
        p.vx += nx * force
        p.vy += ny * force
        break
      case 'attract':
        p.vx -= nx * force
        p.vy -= ny * force
        break
      case 'swirl':
        p.vx += -ny * force
        p.vy += nx * force
        break
      default:
        break
    }
  }

  private tick(dt: number, time: number): void {
    const { ctx } = this
    if (this.cssW === 0 || this.cssH === 0) return
    this.easeLive(dt)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    // Trail / clear: paint translucent black so motion leaves fading streaks.
    const fade = Math.max(0.05, 1 - this.live.trail * 0.85)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(0, 0, 0, ${fade})`
    ctx.fillRect(0, 0, this.cssW, this.cssH)

    const want = { x: 0, y: 0 }
    const velEase = 1 - Math.exp(-dt * VELOCITY_EASE)
    const colEase = 1 - Math.exp(-dt * COLOR_EASE)
    const margin = 12

    for (const p of this.particles) {
      this.desiredVelocity(p, time, want)
      // Relax velocity toward the pattern target (smooths motion-pattern swaps).
      p.vx += (want.x - p.vx) * velEase
      p.vy += (want.y - p.vy) * velEase
      // Turbulence: a little random push each frame.
      const turb = this.live.turbulence
      p.vx += (Math.random() - 0.5) * turb * dt
      p.vy += (Math.random() - 0.5) * turb * dt

      this.applyPointer(p, dt)

      p.x += p.vx * dt
      p.y += p.vy * dt

      // Wrap toroidally so the field is seamless and never empties.
      if (p.x < -margin) p.x += this.cssW + margin * 2
      else if (p.x > this.cssW + margin) p.x -= this.cssW + margin * 2
      if (p.y < -margin) p.y += this.cssH + margin * 2
      else if (p.y > this.cssH + margin) p.y -= this.cssH + margin * 2

      // Cross-fade colour toward the theme target.
      p.r += (p.tr - p.r) * colEase
      p.g += (p.tg - p.g) * colEase
      p.b += (p.tb - p.b) * colEase
    }

    this.drawConnections()
    this.drawParticles()
  }

  private drawConnections(): void {
    const maxDist = this.live.connectDistance
    if (maxDist < 1) return
    const { ctx, particles } = this
    ctx.globalCompositeOperation = 'lighter'
    ctx.shadowBlur = 0
    ctx.lineWidth = 1
    const maxSq = maxDist * maxDist
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i]
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d2 = dx * dx + dy * dy
        if (d2 > maxSq) continue
        const closeness = 1 - Math.sqrt(d2) / maxDist
        ctx.strokeStyle = `rgba(${a.r | 0}, ${a.g | 0}, ${a.b | 0}, ${0.18 * closeness})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
  }

  private drawParticles(): void {
    const { ctx } = this
    const glow = this.live.glow
    ctx.globalCompositeOperation = 'lighter'
    for (const p of this.particles) {
      const r = p.r | 0
      const g = p.g | 0
      const b = p.b | 0
      ctx.shadowBlur = glow
      ctx.shadowColor = `rgb(${r}, ${g}, ${b})`
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }
}
