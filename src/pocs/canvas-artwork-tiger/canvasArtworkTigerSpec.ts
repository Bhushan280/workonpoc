import type { CanvasArtworkSpecDragon } from '../canvas-artwork-dragon/engine'
import {
  CANVAS_ARTWORK_TIGER_GRADIENT,
  CANVAS_ARTWORK_TIGER_PATH_D,
  CANVAS_ARTWORK_TIGER_VIEW_BOX,
} from './canvasArtworkTigerData'

/**
 * Golden tiger stripe field. The repeat lattice was measured from the path
 * geometry (scripts/detect-lattice.mjs): the dominant translational symmetry is
 * a ~154×154 rectangular cell with no row shear. One cell is cropped from the
 * populated interior of the field and tiled (clipped per cell, so the stripes'
 * negative space is preserved instead of flooding solid).
 */
export const CANVAS_ARTWORK_TIGER_SPEC: CanvasArtworkSpecDragon = {
  viewBox: { ...CANVAS_ARTWORK_TIGER_VIEW_BOX },
  pathData: CANVAS_ARTWORK_TIGER_PATH_D,
  fillRule: 'nonzero',
  tile: { x: 48, y: 41, width: 154, height: 154 },
  rowShear: 0,
  gradient: {
    x1: CANVAS_ARTWORK_TIGER_GRADIENT.x1,
    y1: CANVAS_ARTWORK_TIGER_GRADIENT.y1,
    x2: CANVAS_ARTWORK_TIGER_GRADIENT.x2,
    y2: CANVAS_ARTWORK_TIGER_GRADIENT.y2,
    stops: CANVAS_ARTWORK_TIGER_GRADIENT.stops.map((s) => ({
      offset: s.offset,
      color: s.color,
    })),
  },
}
