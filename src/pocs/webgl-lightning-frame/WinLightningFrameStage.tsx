import { useEffect, useRef, useState } from 'react'
import './WinLightningFrameStage.css'
import { WinLightningFrameRenderer } from './engine/winLightningFrameRenderer'

const PHRASE = 'Coming soon...'
const TYPE_MS = 130
const ERASE_MS = 55
const HOLD_FULL_MS = 1500
const HOLD_EMPTY_MS = 550

export default function WinLightningFrameStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  // WebGL lightning frame: init, keep sized to the box, animate, clean up.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: WinLightningFrameRenderer
    try {
      renderer = new WinLightningFrameRenderer(canvas)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return
    }

    const sync = (): void => {
      renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1)
    }
    sync()
    renderer.start()

    let frame = 0
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(sync)
          })
        : null
    observer?.observe(canvas)

    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      renderer.dispose()
    }
  }, [])

  // Infinite typewriter: type the phrase, hold, erase, hold, repeat.
  useEffect(() => {
    let index = 0
    let erasing = false
    let timer: ReturnType<typeof setTimeout>

    const tick = (): void => {
      setTyped(PHRASE.slice(0, index))
      if (!erasing) {
        if (index >= PHRASE.length) {
          erasing = true
          timer = setTimeout(tick, HOLD_FULL_MS)
          return
        }
        index += 1
        timer = setTimeout(tick, TYPE_MS)
      } else {
        if (index <= 0) {
          erasing = false
          timer = setTimeout(tick, HOLD_EMPTY_MS)
          return
        }
        index -= 1
        timer = setTimeout(tick, ERASE_MS)
      }
    }

    tick()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="win-lightning-frame-poc">
      <div className="win-lightning-frame-poc__stage">
        <canvas
          ref={canvasRef}
          className="win-lightning-frame-poc__canvas"
          aria-label="Animated WebGL lightning frame"
        />

        <div className="win-lightning-frame-poc__overlay">
          <span className="win-lightning-frame-poc__eyebrow">Win Lightning Frame</span>
          <p className="win-lightning-frame-poc__typer" aria-live="polite">
            <span className="win-lightning-frame-poc__typed">{typed}</span>
            <span className="win-lightning-frame-poc__cursor" aria-hidden="true" />
          </p>
        </div>

        {error ? <p className="win-lightning-frame-poc__error">{error}</p> : null}
      </div>
    </div>
  )
}
