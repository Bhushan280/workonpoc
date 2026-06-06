import type { PocEntry } from './types'
import ImageGrid from './image-grid/ImageGrid'
import CanvasArtworkDragonStage from './canvas-artwork-dragon/CanvasArtworkDragonStage'
import CanvasArtworkTigerStage from './canvas-artwork-tiger/CanvasArtworkTigerStage'

/** Add new POCs here — each entry appears in the side panel. */
export const POCS: PocEntry[] = [
  {
    id: 'image-grid',
    label: 'Image grid mask',
    description: 'Single photo masked into a 2×3 rounded cell grid',
    component: ImageGrid,
  },
  {
    id: 'canvas-artwork-dragon',
    label: 'Canvas artwork dragon',
    description: 'Pure Path2D + gradient render of the dragon leaf field, responsive & tiled',
    component: CanvasArtworkDragonStage,
  },
  {
    id: 'canvas-artwork-tiger',
    label: 'Canvas artwork tiger',
    description: 'Golden tiger pattern via Path2D + drawImage grid, scalable & symmetric',
    component: CanvasArtworkTigerStage,
  },
]

export const DEFAULT_POC_ID = POCS[0]?.id ?? ''
