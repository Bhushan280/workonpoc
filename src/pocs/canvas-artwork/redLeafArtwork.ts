import { LEAF_GRADIENT, LEAF_PATH_D, LEAF_VIEW_BOX } from './leafArtworkData'
import type { ArtworkSpec } from './engine'

/**
 * The red fish-scale leaf field, described as plain data for the pure-Canvas
 * renderer. The path + gradient are the single source of truth shared with the
 * SVG demo, so the two POCs always draw the same artwork.
 */
export const RED_LEAF_ARTWORK: ArtworkSpec = {
  viewBox: { ...LEAF_VIEW_BOX },
  pathData: LEAF_PATH_D,
  fillRule: 'nonzero',
  // Reverse-engineered lattice (not the SVG viewBox): the field is a half-drop
  // pattern with a ~220.1u horizontal period and a (108.5, 111)u row vector.
  // One cell is cropped from the periodic interior (y = 66) and stamped with
  // the row shear so successive rows interlock seamlessly.
  tile: { x: 0, y: 66, width: 220.1, height: 111 },
  rowShear: 108.5,
  gradient: {
    x1: LEAF_GRADIENT.x1,
    y1: LEAF_GRADIENT.y1,
    x2: LEAF_GRADIENT.x2,
    y2: LEAF_GRADIENT.y2,
    stops: LEAF_GRADIENT.stops.map((s) => ({ offset: s.offset, color: s.color })),
  },
}
