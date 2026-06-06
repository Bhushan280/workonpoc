import { useEffect, useRef } from 'react'
import { ParticleCanvas } from './ParticleCanvas'
import { getThemeForPoc } from './particleThemes'
import './ParticleBackground.css'

type ParticleBackgroundProps = {
  /** Active POC id; the field morphs to this experiment's theme. */
  activeId: string
}

/**
 * Fixed, full-viewport particle field that lives behind the whole lab UI. It
 * owns a single {@link ParticleCanvas}, keeps it sized to the window, and feeds
 * it the theme for whichever experiment is active so the background adapts.
 */
export default function ParticleBackground({ activeId }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ParticleCanvas | null>(null)

  // Create the engine once and keep it sized to the viewport.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: ParticleCanvas
    try {
      engine = new ParticleCanvas(canvas, getThemeForPoc(activeId))
    } catch {
      return
    }
    engineRef.current = engine

    const sync = (): void => {
      engine.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
    }
    sync()
    engine.start()

    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      engine.dispose()
      engineRef.current = null
    }
    // Engine is created once; theme changes are handled in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Morph the field whenever the active experiment changes.
  useEffect(() => {
    engineRef.current?.setTheme(getThemeForPoc(activeId))
  }, [activeId])

  return <canvas ref={canvasRef} className="particle-bg" aria-hidden="true" />
}
