/**
 * WebGL renderer for an animated electric "lightning" frame.
 *
 * A single full-screen triangle is shaded so a jagged, flickering bolt crawls
 * around the rectangular border. The geometry is procedural (distance-to-edge +
 * animated fbm noise), so it fills any canvas size and animates indefinitely
 * with a constant cost — no textures, no per-frame uploads.
 */

const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;

  float dl = uv.x;
  float dr = 1.0 - uv.x;
  float db = uv.y;
  float dt = 1.0 - uv.y;
  float d = min(min(dl, dr), min(db, dt));

  // A coordinate that runs continuously around the perimeter so the bolt and
  // its flicker crawl around the frame instead of jumping at the corners.
  float e;
  if (d == dl) e = uv.y;
  else if (d == dr) e = 2.0 + (1.0 - uv.y);
  else if (d == db) e = 4.0 + uv.x * aspect;
  else e = 6.0 + (1.0 - uv.x) * aspect;

  float t = u_time;

  // Jagged displacement of the border = the lightning path.
  float jag = (fbm(vec2(e * 9.0, t * 1.8)) - 0.5) * 0.045;
  jag += (fbm(vec2(e * 24.0, t * 3.6)) - 0.5) * 0.018;
  float bolt = d + jag;

  float glow = 0.011 / max(bolt, 0.0006);
  glow = clamp(glow, 0.0, 3.0);

  float flick = 0.55 + 0.45 * fbm(vec2(e * 4.0, t * 7.0));

  vec3 elec = vec3(0.35, 0.66, 1.0);
  vec3 col = elec * glow * flick;

  // White-hot core right on the bolt.
  col += vec3(0.85, 0.92, 1.0) * smoothstep(0.010, 0.0, bolt);

  // Occasional brighter strikes sweeping around the perimeter.
  float strike = pow(fbm(vec2(e * 2.0, floor(t * 6.0) + 0.5)), 4.0);
  col += elec * strike * glow * 1.4;

  // Dark, faintly graded background so the centre text reads.
  vec3 bg = mix(vec3(0.02, 0.03, 0.06), vec3(0.06, 0.02, 0.10), uv.y);
  col += bg;

  gl_FragColor = vec4(col, 1.0);
}
`

export class WinLightningFrameRenderer {
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly uTime: WebGLUniformLocation | null
  private readonly uRes: WebGLUniformLocation | null
  private readonly buffer: WebGLBuffer
  private rafId = 0
  private startTime = 0
  private running = false

  constructor(canvas: HTMLCanvasElement) {
    const gl =
      (canvas.getContext('webgl', { antialias: true, premultipliedAlpha: false }) as
        | WebGLRenderingContext
        | null) ?? (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (!gl) throw new Error('WebGL is not available in this environment')
    this.gl = gl

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    this.uTime = gl.getUniformLocation(this.program, 'u_time')
    this.uRes = gl.getUniformLocation(this.program, 'u_res')

    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('Could not allocate a WebGL buffer')
    this.buffer = buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    // One oversized triangle that covers the whole clip-space.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

    const aPos = gl.getAttribLocation(this.program, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
  }

  /** Resize the backing buffer to the CSS box times the device pixel ratio. */
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    const w = Math.max(1, Math.round(cssWidth * pixelRatio))
    const h = Math.max(1, Math.round(cssHeight * pixelRatio))
    const canvas = this.gl.canvas as HTMLCanvasElement
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    this.gl.viewport(0, 0, w, h)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.startTime = performance.now()
    const loop = (now: number): void => {
      if (!this.running) return
      this.renderFrame((now - this.startTime) / 1000)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  dispose(): void {
    this.stop()
    const gl = this.gl
    gl.deleteBuffer(this.buffer)
    gl.deleteProgram(this.program)
  }

  private renderFrame(timeSeconds: number): void {
    const gl = this.gl
    gl.useProgram(this.program)
    if (this.uRes) gl.uniform2f(this.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight)
    if (this.uTime) gl.uniform1f(this.uTime, timeSeconds)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private createProgram(vertexSrc: string, fragmentSrc: string): WebGLProgram {
    const gl = this.gl
    const program = gl.createProgram()
    if (!program) throw new Error('Could not create a WebGL program')
    gl.attachShader(program, this.compileShader(gl.VERTEX_SHADER, vertexSrc))
    gl.attachShader(program, this.compileShader(gl.FRAGMENT_SHADER, fragmentSrc))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`WebGL program failed to link: ${log ?? 'unknown error'}`)
    }
    return program
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)
    if (!shader) throw new Error('Could not create a WebGL shader')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader failed to compile: ${log ?? 'unknown error'}`)
    }
    return shader
  }
}
