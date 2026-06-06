import {
  CANVAS_ARTWORK_DRAGON_GRADIENT,
  CANVAS_ARTWORK_DRAGON_PATH_D,
  CANVAS_ARTWORK_DRAGON_VIEW_BOX,
} from './canvasArtworkDragonData'
import type { CanvasArtworkSpecDragon } from './engine'

/**
 * The red dragon leaf field, described as plain data for the pure-Canvas
 * renderer (path geometry + gradient stops + tiling lattice).
 */
export const CANVAS_ARTWORK_DRAGON_SPEC: CanvasArtworkSpecDragon = {
  viewBox: { ...CANVAS_ARTWORK_DRAGON_VIEW_BOX },
  pathData: CANVAS_ARTWORK_DRAGON_PATH_D,
  fillRule: 'nonzero',
  // Lattice measured from the path geometry (scripts/detect-lattice.mjs):
  // horizontal period 223u (score 0.95) with row vector (201, 134) (score 0.98)
  // — a sheared/half-drop field. One cell is cropped from the periodic interior
  // (y = 66) and brick-laid with the row shear so copies interlock seamlessly.
  tile: { x: 0, y: 66, width: 223, height: 134 },
  rowShear: 201,
  gradient: {
    x1: CANVAS_ARTWORK_DRAGON_GRADIENT.x1,
    y1: CANVAS_ARTWORK_DRAGON_GRADIENT.y1,
    x2: CANVAS_ARTWORK_DRAGON_GRADIENT.x2,
    y2: CANVAS_ARTWORK_DRAGON_GRADIENT.y2,
    stops: CANVAS_ARTWORK_DRAGON_GRADIENT.stops.map((s) => ({
      offset: s.offset,
      color: s.color,
    })),
  },
}
