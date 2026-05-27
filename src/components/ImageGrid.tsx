import { useState, type CSSProperties } from 'react'
import '../css/ImageGrid.css'
import { IMAGES } from '../assets'

const COLS = 2
const ROWS = 3
const GRID_W = 600
const GRID_H = 600
const GAP = 20
const CELL_RADIUS = 12

function buildCellMaskUrl(
  cols: number,
  rows: number,
  width: number,
  height: number,
  gap: number,
  radius: number,
): string {
  const cellW = (width - gap) / cols
  const cellH = (height - gap * (rows - 1)) / rows

  const rects = Array.from({ length: cols * rows }, (_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * (cellW + gap)
    const y = row * (cellH + gap)
    return `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="${radius}" ry="${radius}" fill="white"/>`
  }).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const CELL_MASK = buildCellMaskUrl(COLS, ROWS, GRID_W, GRID_H, GAP, CELL_RADIUS)

const PHOTO_MASK_STYLE: CSSProperties = {
  maskImage: CELL_MASK,
  WebkitMaskImage: CELL_MASK,
}

export default function ImageGrid() {
  const [imageIndex, setImageIndex] = useState(0)

  const switchImage = () => {
    setImageIndex((prev) => (prev + 1) % IMAGES.length)
  }

  const photoStyle: CSSProperties = {
    backgroundImage: `url(${IMAGES[imageIndex]})`,
    ...PHOTO_MASK_STYLE,
  }

  return (
    <div className="page">
      <div className="container">
        <div className="image-stage">
          {/* One background image for the whole grid — mask cuts it into cell windows */}
          <div className="stage-photo" style={photoStyle} role="img" aria-label="Photo grid" />
        </div>
        <button type="button" className="switch-btn" onClick={switchImage}>
          Next image ({imageIndex + 1} / {IMAGES.length})
        </button>
      </div>
    </div>
  )
}
