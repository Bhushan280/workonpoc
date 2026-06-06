/**
 * Reads an SVG file and emits a TypeScript data module with joined path `d`
 * strings, viewBox, and gradient (first linearGradient found).
 *
 * Usage: node scripts/extract-svg-paths.mjs <svg-file> <export-prefix>
 * Example: node scripts/extract-svg-paths.mjs tiger.svg CANVAS_ARTWORK_TIGER
 */
import fs from 'node:fs'

const [svgPath, prefix = 'ART'] = process.argv.slice(2)
if (!svgPath) {
  console.error('Usage: node extract-svg-paths.mjs <svg-file> [EXPORT_PREFIX]')
  process.exit(1)
}

const svg = fs.readFileSync(svgPath, 'utf8')
const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
if (paths.length === 0) {
  console.error('No <path d="..."> elements found')
  process.exit(1)
}

const viewBoxMatch = svg.match(/viewBox="([^"]+)"/)
const vb = viewBoxMatch
  ? viewBoxMatch[1].split(/\s+/).map(Number)
  : [0, 0, 239, 180]

const firstGradBlock = svg.match(/<linearGradient[\s\S]*?<\/linearGradient>/)
const gradSrc = firstGradBlock?.[0] ?? svg
const gradMatch = gradSrc.match(
  /<linearGradient[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"[^>]*>/,
)
const stopTags = [...gradSrc.matchAll(/<stop([^>]*)\/?>/g)]
const parsedStops = stopTags.map(([, attrs]) => {
  const offset = attrs.match(/offset="([^"]+)"/)?.[1] ?? '0'
  const color = attrs.match(/stop-color="([^"]+)"/)?.[1] ?? '#000000'
  const opacity = attrs.match(/stop-opacity="([^"]+)"/)?.[1]
  if (opacity !== undefined) {
    const a = Math.round(Number(opacity) * 255)
      .toString(16)
      .padStart(2, '0')
    return `    { offset: ${offset}, color: '${color}${a}' },`
  }
  return `    { offset: ${offset}, color: '${color}' },`
})
const stopLines = parsedStops.length > 0 ? parsedStops : [`    { offset: 0, color: '#000000' },`]

const joined = paths.join(' ')
const chunkSize = 8000
const chunks = []
for (let i = 0; i < joined.length; i += chunkSize) {
  chunks.push(joined.slice(i, i + chunkSize))
}

const grad = gradMatch
  ? {
      x1: Number(gradMatch[1]),
      y1: Number(gradMatch[2]),
      x2: Number(gradMatch[3]),
      y2: Number(gradMatch[4]),
    }
  : { x1: 0, y1: 0, x2: 0, y2: 180 }

process.stdout.write(`/**
 * Auto-extracted from ${svgPath} (${paths.length} subpaths).
 */
const D: string[] = []
`)
for (const chunk of chunks) {
  process.stdout.write(`D.push(\`${chunk}\`)\n`)
}
process.stdout.write(`
export const ${prefix}_PATH_D = D.join('')

export const ${prefix}_VIEW_BOX = { x: ${vb[0]}, y: ${vb[1]}, width: ${vb[2]}, height: ${vb[3]} } as const

export const ${prefix}_GRADIENT = {
  x1: ${grad.x1},
  y1: ${grad.y1},
  x2: ${grad.x2},
  y2: ${grad.y2},
  stops: [
${stopLines.join('\n')}
  ],
} as const
`)

console.error(`Extracted ${paths.length} paths, ${joined.length} chars`)
