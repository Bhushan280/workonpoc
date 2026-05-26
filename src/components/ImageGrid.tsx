import { useState } from 'react'
import '../css/ImageGrid.css'
import { IMAGES } from '../assets'

const COLS = 2
const ROWS = 3
const W = 600
const H = 600
const GAP = 20

const cellW = (W - GAP) / COLS
const cellH = (H - GAP * (ROWS - 1)) / ROWS

type CellPosition = { x: number; y: number }

const cells: CellPosition[] = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  return {
    x: -(col * (cellW + GAP)),
    y: -(row * (cellH + GAP)),
  }
})

export default function ImageGrid() {
  const [imageIndex, setImageIndex] = useState(0)
  const currentImage = IMAGES[imageIndex]

  const switchImage = () => {
    setImageIndex((prev) => (prev + 1) % IMAGES.length)
  }

  return (
    <div className="page">
      <div className="container">
        <div className="grid-wrapper">
          {cells.map((pos, i) => (
            <div
              key={i}
              className="cell"
              style={{
                backgroundImage: `url(${currentImage})`,
                backgroundSize: `${W}px ${H}px`,
                backgroundPosition: `${pos.x}px ${pos.y}px`,
                backgroundRepeat: 'no-repeat',
              }}
            />
          ))}
        </div>
        <button type="button" className="switch-btn" onClick={switchImage}>
          Next image ({imageIndex + 1} / {IMAGES.length})
        </button>
      </div>
    </div>
  )
}
