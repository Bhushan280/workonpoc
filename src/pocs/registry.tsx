import type { PocEntry } from './types'
import ImageGrid from './image-grid/ImageGrid'
import CanvasArtworkStage from './canvas-artwork/CanvasArtworkStage'

/** Add new POCs here — each entry appears in the side panel. */
export const POCS: PocEntry[] = [
  {
    id: 'image-grid',
    label: 'Image grid mask',
    description: 'Single photo masked into a 2×3 rounded cell grid',
    component: ImageGrid,
  },
  {
    id: 'canvas-artwork',
    label: 'Canvas artwork (Path2D)',
    description: 'Pure Path2D + gradient render of the leaf field, responsive & tiled',
    component: CanvasArtworkStage,
  },
]

export const DEFAULT_POC_ID = POCS[0]?.id ?? ''
