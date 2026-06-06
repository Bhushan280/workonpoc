import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CanvasArtworkDragonRenderer } from '../canvas-artwork-dragon/engine'
import './CanvasArtworkTigerStage.css'
import { CANVAS_ARTWORK_TIGER_SPEC } from './canvasArtworkTigerSpec'

interface Pan {
  x: number
  y: number
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  origin: Pan
}

export default function CanvasArtworkTigerStage() {
  const [error, setError] = useState<string | null>(null)
  const [tileScale, setTileScale] = useState(1)
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragState | null>(null)

  const artwork = useMemo(() => {
    try {
      return {
        instance: new CanvasArtworkDragonRenderer(CANVAS_ARTWORK_TIGER_SPEC),
        error: null as string | null,
      }
    } catch (err) {
      return { instance: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!artwork.instance) {
      setError(artwork.error)
      return
    }
    try {
      artwork.instance.draw(canvas, {
        tileScale,
        panX: pan.x,
        panY: pan.y,
        pixelRatio: window.devicePixelRatio || 1,
        background: '#ffffff',
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [artwork, tileScale, pan.x, pan.y])

  useLayoutEffect(() => {
    draw()
  }, [draw])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    let frameId = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(draw)
    })
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [draw])

  const endDrag = useCallback((pointerId: number) => {
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
    dragRef.current = null
    setIsDragging(false)
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origin: pan,
      }
      setIsDragging(true)
    },
    [pan],
  )

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    setPan({
      x: drag.origin.x + (event.clientX - drag.startX),
      y: drag.origin.y + (event.clientY - drag.startY),
    })
  }, [])

  const onPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragRef.current?.pointerId !== event.pointerId) return
      endDrag(event.pointerId)
    },
    [endDrag],
  )

  const reset = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
    setPan({ x: 0, y: 0 })
    setTileScale(1)
  }, [])

  return (
    <div className="canvas-artwork-tiger-poc">
      <section className="canvas-artwork-tiger-poc__controls" aria-label="Renderer controls">
        <header className="canvas-artwork-tiger-poc__header">
          <h1 className="canvas-artwork-tiger-poc__title">Canvas artwork tiger</h1>
          <p className="canvas-artwork-tiger-poc__subtitle">
            The golden tiger pattern is filled continuously as a vector{' '}
            <code>Path2D</code> at every lattice point — no pre-made bitmap tiles — so it
            covers the canvas with no gaps and grows symmetrically. A single vertical
            gradient spans the full canvas. Drag the corner to resize; drag to pan.
          </p>
        </header>

        <label className="canvas-artwork-tiger-poc__field">
          <span className="canvas-artwork-tiger-poc__field-label">
            Tile size: {tileScale.toFixed(2)}×
          </span>
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={tileScale}
            onChange={(event) => setTileScale(Number(event.target.value))}
          />
        </label>

        <button type="button" className="canvas-artwork-tiger-poc__reset" onClick={reset}>
          Reset view
        </button>

        {error ? <p className="canvas-artwork-tiger-poc__error">{error}</p> : null}
      </section>

      <section className="canvas-artwork-tiger-poc__stage-area" aria-label="Canvas stage">
        <div className="canvas-artwork-tiger-poc__stage-shell">
          <canvas
            ref={canvasRef}
            className={
              isDragging
                ? 'canvas-artwork-tiger-poc__canvas canvas-artwork-tiger-poc__canvas_dragging'
                : 'canvas-artwork-tiger-poc__canvas canvas-artwork-tiger-poc__canvas_pannable'
            }
            aria-label="Canvas artwork tiger"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          />
        </div>
      </section>
    </div>
  )
}
