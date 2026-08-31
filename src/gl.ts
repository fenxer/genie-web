const VERT = `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform vec2 u_res;
varying vec2 v_uv;
void main() {
  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_uv;
}
`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
void main() {
  vec4 c = texture2D(u_tex, v_uv);
  float a = c.a * u_alpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(c.rgb * a, a);
}
`;

const LINE_VERT = `
attribute vec2 a_pos;
uniform vec2 u_res;
void main() {
  vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const LINE_FRAG = `
precision highp float;
uniform float u_alpha;
void main() {
  vec3 rgb = vec3(0.45, 0.92, 1.0);
  gl_FragColor = vec4(rgb * u_alpha, u_alpha);
}
`;

/** Uint16 element indices address at most 65536 vertices. */
const MAX_VERTS = 65536;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("genie-web: shader alloc failed");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "shader compile failed");
  }
  return shader;
}

function link(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
  const program = gl.createProgram();
  if (!program) throw new Error("genie-web: program alloc failed");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "program link failed");
  }
  return program;
}

function clampGrid(cols: number, rows: number) {
  cols = Math.max(2, Math.round(cols));
  rows = Math.max(2, Math.round(rows));
  const verts = (cols + 1) * (rows + 1);
  if (verts <= MAX_VERTS) return { cols, rows };
  const scale = Math.sqrt(MAX_VERTS / verts);
  cols = Math.max(2, Math.floor(cols * scale));
  rows = Math.max(2, Math.floor(rows * scale));
  while ((cols + 1) * (rows + 1) > MAX_VERTS) {
    if (rows >= cols && rows > 2) rows--;
    else cols = Math.max(2, cols - 1);
  }
  return { cols, rows };
}

export class MeshRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private lineProgram: WebGLProgram | null = null;
  private posBuf: WebGLBuffer;
  private uvBuf: WebGLBuffer;
  private idxBuf: WebGLBuffer;
  private lineBuf: WebGLBuffer | null = null;
  private texture: WebGLTexture;
  positions = new Float32Array(0);
  cols = 0;
  rows = 0;
  private indexCount = 0;
  private lineCount = 0;
  private aPos: number;
  private aUv: number;
  private uRes: WebGLUniformLocation | null;
  private uTex: WebGLUniformLocation | null;
  private uAlpha: WebGLUniformLocation | null;
  private lineAPos = -1;
  private lineURes: WebGLUniformLocation | null = null;
  private lineUAlpha: WebGLUniformLocation | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true
    });
    if (!gl) throw new Error("genie-web: WebGL unavailable");
    this.canvas = canvas;
    this.gl = gl;
    this.program = link(gl, VERT, FRAG);
    this.posBuf = gl.createBuffer()!;
    this.uvBuf = gl.createBuffer()!;
    this.idxBuf = gl.createBuffer()!;
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.aPos = gl.getAttribLocation(this.program, "a_pos");
    this.aUv = gl.getAttribLocation(this.program, "a_uv");
    this.uRes = gl.getUniformLocation(this.program, "u_res");
    this.uTex = gl.getUniformLocation(this.program, "u_tex");
    this.uAlpha = gl.getUniformLocation(this.program, "u_alpha");
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * dpr);
    const h = Math.round(innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  release() {
    if (this.canvas.width !== 1 || this.canvas.height !== 1) {
      this.canvas.width = 1;
      this.canvas.height = 1;
    }
    this.gl.viewport(0, 0, 1, 1);
  }

  rebuild(cols: number, rows: number) {
    ({ cols, rows } = clampGrid(cols, rows));
    this.cols = cols;
    this.rows = rows;
    const gl = this.gl;
    const vCount = (cols + 1) * (rows + 1);
    this.positions = new Float32Array(vCount * 2);
    const uvs = new Float32Array(vCount * 2);
    const indices = new Uint16Array(cols * rows * 6);

    let u = 0;
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        uvs[u] = c / cols;
        uvs[u + 1] = 1 - r / rows;
        u += 2;
      }
    }

    let t = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * (cols + 1) + c;
        const n = i + cols + 1;
        indices[t++] = i;
        indices[t++] = i + 1;
        indices[t++] = n + 1;
        indices[t++] = i;
        indices[t++] = n + 1;
        indices[t++] = n;
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.indexCount = indices.length;
    this.rebuildLines();
  }

  private ensureWireframe() {
    if (this.lineProgram) return;
    const gl = this.gl;
    this.lineProgram = link(gl, LINE_VERT, LINE_FRAG);
    this.lineBuf = gl.createBuffer()!;
    this.lineAPos = gl.getAttribLocation(this.lineProgram, "a_pos");
    this.lineURes = gl.getUniformLocation(this.lineProgram, "u_res");
    this.lineUAlpha = gl.getUniformLocation(this.lineProgram, "u_alpha");
    this.rebuildLines();
  }

  private rebuildLines() {
    if (!this.lineBuf) return;
    const { cols, rows, gl } = this;
    const lines: number[] = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * (cols + 1) + c;
        lines.push(i, i + 1);
      }
    }
    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r < rows; r++) {
        const i = r * (cols + 1) + c;
        lines.push(i, i + cols + 1);
      }
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(lines), gl.STATIC_DRAW);
    this.lineCount = lines.length;
  }

  upload(source: TexImageSource) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  draw(alpha: number, wireframe: boolean) {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf);
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform2f(this.uRes, innerWidth, innerHeight);
    gl.uniform1i(this.uTex, 0);
    gl.uniform1f(this.uAlpha, alpha);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    if (wireframe) {
      this.ensureWireframe();
      const lineProgram = this.lineProgram!;
      gl.useProgram(lineProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
      gl.enableVertexAttribArray(this.lineAPos);
      gl.vertexAttribPointer(this.lineAPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineBuf);
      gl.uniform2f(this.lineURes, innerWidth, innerHeight);
      gl.uniform1f(this.lineUAlpha, Math.max(0.35, alpha));
      gl.drawElements(gl.LINES, this.lineCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  clear() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}
