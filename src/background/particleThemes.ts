/**
 * Per-experiment particle themes. Each POC in the lab maps to one of these, and
 * the {@link ParticleCanvas} smoothly morphs from the previous theme to the new
 * one when the active experiment changes — so the background reads as a single
 * living layer that adapts its colour, motion, density and feel per lab mode.
 */

export type MotionPattern = 'drift' | 'rise' | 'swirl' | 'wander' | 'stream'
export type PointerMode = 'none' | 'repel' | 'attract' | 'swirl'

/** RGB triple, 0–255. */
export type Rgb = readonly [number, number, number]

export type ParticleTheme = {
  /** Human-readable name (handy for debugging / future UI). */
  name: string
  /** Signature colour for the UI chrome (sidebar tint, accents) under this theme. */
  accent: Rgb
  /** Palette each particle picks from; particles cross-fade toward a new pick on theme change. */
  colors: readonly Rgb[]
  /** Particles per 100,000 css px² of viewport (count scales with screen area). */
  density: number
  /** Base travel speed, css px/s. */
  speed: number
  /** Particle radius range, css px. */
  size: readonly [number, number]
  /** Additive glow radius (canvas shadowBlur), css px. 0 = flat dots. */
  glow: number
  /** Per-particle opacity range. */
  alpha: readonly [number, number]
  /** How the field moves as a whole. */
  motion: MotionPattern
  /** Travel direction for drift/stream, radians (0 = +x, -PI/2 = up). */
  direction: number
  /** Lateral sway amplitude for `rise`, css px/s. */
  sway: number
  /** Random wander injected into velocity each second, css px/s. */
  turbulence: number
  /** How the field reacts to the pointer. */
  pointer: PointerMode
  /** Pointer influence radius, css px. */
  pointerRadius: number
  /** Pointer force strength, css px/s. */
  pointerForce: number
  /** Motion-blur trail, 0 (crisp) … 1 (long comet trails). */
  trail: number
  /** Draw constellation lines between particles closer than this (css px). 0 = off. */
  connectDistance: number
}

const DEFAULT_THEME: ParticleTheme = {
  name: 'lab',
  accent: [150, 180, 255],
  colors: [
    [180, 200, 255],
    [140, 170, 240],
    [205, 220, 255],
  ],
  density: 5,
  speed: 14,
  size: [1, 2.6],
  glow: 8,
  alpha: [0.25, 0.7],
  motion: 'drift',
  direction: -0.4,
  sway: 0,
  turbulence: 6,
  pointer: 'repel',
  pointerRadius: 280,
  pointerForce: 60,
  trail: 0.2,
  connectDistance: 0,
}

/** Cool constellation — slow blue drift with linking lines, like a calm grid field. */
const IMAGE_GRID_THEME: ParticleTheme = {
  name: 'image-grid',
  accent: [120, 200, 255],
  colors: [
    [120, 200, 255],
    [90, 150, 255],
    [165, 230, 255],
  ],
  density: 4.6,
  speed: 10,
  size: [1.2, 2.6],
  glow: 6,
  alpha: [0.3, 0.78],
  motion: 'drift',
  direction: 0.3,
  sway: 0,
  turbulence: 4,
  pointer: 'repel',
  pointerRadius: 300,
  pointerForce: 54,
  trail: 0.12,
  connectDistance: 120,
}

/** Crimson embers rising and swaying, with a warm glow — the dragon furnace. */
const DRAGON_THEME: ParticleTheme = {
  name: 'dragon',
  accent: [255, 110, 70],
  colors: [
    [255, 90, 60],
    [255, 150, 40],
    [220, 40, 30],
    [255, 200, 120],
  ],
  density: 6,
  speed: 26,
  size: [1, 3],
  glow: 14,
  alpha: [0.35, 0.85],
  motion: 'rise',
  direction: -Math.PI / 2,
  sway: 16,
  turbulence: 14,
  pointer: 'repel',
  pointerRadius: 300,
  pointerForce: 68,
  trail: 0.45,
  connectDistance: 0,
}

/** Golden motes swirling around the centre — the tiger's warm spin. */
const TIGER_THEME: ParticleTheme = {
  name: 'tiger',
  accent: [255, 190, 70],
  colors: [
    [255, 196, 70],
    [255, 150, 30],
    [255, 225, 150],
    [210, 130, 20],
  ],
  density: 6.5,
  speed: 22,
  size: [1, 3],
  glow: 12,
  alpha: [0.35, 0.85],
  motion: 'swirl',
  direction: 0,
  sway: 0,
  turbulence: 8,
  pointer: 'repel',
  pointerRadius: 320,
  pointerForce: 72,
  trail: 0.3,
  connectDistance: 0,
}

/** Violet wind — fast directional streaks with long trails, electric and gusty. */
const LIGHTNING_THEME: ParticleTheme = {
  name: 'lightning-wind',
  accent: [200, 130, 255],
  colors: [
    [200, 130, 255],
    [230, 180, 255],
    [150, 80, 255],
    [255, 245, 255],
  ],
  density: 7,
  speed: 82,
  size: [0.8, 2.2],
  glow: 14,
  alpha: [0.4, 0.9],
  motion: 'stream',
  direction: 0.12,
  sway: 0,
  turbulence: 22,
  pointer: 'repel',
  pointerRadius: 310,
  pointerForce: 96,
  trail: 0.6,
  connectDistance: 0,
}

/** POC id → theme. Ids match `src/pocs/registry.tsx`. */
const THEME_BY_POC: Record<string, ParticleTheme> = {
  'image-grid': IMAGE_GRID_THEME,
  'canvas-artwork-dragon': DRAGON_THEME,
  'canvas-artwork-tiger': TIGER_THEME,
  'webgl-lightning-frame': LIGHTNING_THEME,
}

/** Resolve the particle theme for the active POC, falling back to the lab default. */
export function getThemeForPoc(pocId: string): ParticleTheme {
  return THEME_BY_POC[pocId] ?? DEFAULT_THEME
}
