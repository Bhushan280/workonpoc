import { useEffect, useRef, useState } from 'react'
import './WinLightningFrameStage.css'
import { BetSpotLightningBorder } from './engine/betSpotLightningBorder'

const MARGIN = 40 // transparent room around each card for the radiating energy, in CSS px
const RADIUS = 18 // card corner radius, in CSS px

type Tone = 'teal' | 'green' | 'olive' | 'pink'

const TONES: Tone[] = ['teal', 'green', 'olive', 'pink']

function BetSpot({ tone }: { tone: Tone }) {
  const spotRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<BetSpotLightningBorder | null>(null)
  const [won, setWon] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create the lightning renderer once and keep it sized to this BetSpot.
  useEffect(() => {
    const canvas = canvasRef.current
    const spot = spotRef.current
    if (!canvas || !spot) return

    let renderer: BetSpotLightningBorder
    try {
      renderer = new BetSpotLightningBorder(canvas)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return
    }
    rendererRef.current = renderer

    const sync = (): void => {
      const rect = spot.getBoundingClientRect()
      renderer.resize({
        cardWidth: rect.width,
        cardHeight: rect.height,
        radius: RADIUS,
        margin: MARGIN,
        pixelRatio: window.devicePixelRatio || 1,
      })
    }
    sync()

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    observer?.observe(spot)

    return () => {
      observer?.disconnect()
      renderer.dispose()
      rendererRef.current = null
    }
  }, [])

  // Play the clockwise lightning only while this BetSpot is in its "win" state.
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    if (won) renderer.start()
    else renderer.stop()
  }, [won])

  return (
    <button
      ref={spotRef}
      type="button"
      className={`win-lightning-frame-poc__spot win-lightning-frame-poc__spot_${tone}${
        won ? ' win-lightning-frame-poc__spot_won' : ''
      }`}
      onClick={() => setWon((v) => !v)}
      aria-pressed={won}
      aria-label={won ? 'BetSpot — win lightning playing, click to stop' : 'BetSpot — click to play win lightning'}
    >
      <canvas ref={canvasRef} className="win-lightning-frame-poc__lightning" aria-hidden="true" />
      <span className="win-lightning-frame-poc__spot-face">
        <span className={`win-lightning-frame-poc__win${won ? ' win-lightning-frame-poc__win_on' : ''}`}>
          WIN
        </span>
      </span>
      {error ? <span className="win-lightning-frame-poc__error">{error}</span> : null}
    </button>
  )
}

export default function WinLightningFrameStage() {
  return (
    <div className="win-lightning-frame-poc">
      <div className="win-lightning-frame-poc__panel">
        <span className="win-lightning-frame-poc__eyebrow">Win Lightning Frame</span>
        <div className="win-lightning-frame-poc__row">
          {TONES.map((tone) => (
            <BetSpot key={tone} tone={tone} />
          ))}
        </div>
        <p className="win-lightning-frame-poc__hint">
          Click any BetSpot — a neon ring lights its border with energy rotating around it.
        </p>
      </div>
    </div>
  )
}
