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
  // Reverse-engineered lattice (not the SVG viewBox): the field is a half-drop
  // pattern with a ~220.1u horizontal period and a (108.5, 111)u row vector.
  // One cell is cropped from the periodic interior (y = 66) and stamped with
  // the row shear so successive rows interlock seamlessly.
  tile: { x: 0, y: 66, width: 220.1, height: 111 },
  rowShear: 108.5,
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
