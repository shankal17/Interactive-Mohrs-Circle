import * as THREE from 'three';

/** @typedef {[number, number, number?]} Point3Like */

/**
 * Recursively disposes an object's descendants and their GPU resources.
 * @param {THREE.Object3D} group Object whose children should be removed and disposed.
 * @returns {void}
 */
export function disposeChildren(group) {
  while (group.children.length) {
    const c = group.children[0];
    group.remove(c);
    if (c.children && c.children.length) disposeChildren(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (c.material.map) c.material.map.dispose();
      c.material.dispose();
    }
  }
}

/**
 * Builds a straight polyline from world-space points.
 * @param {Point3Like[]} points Polyline points; z defaults to the provided `z` value.
 * @param {number} color Three.js numeric color.
 * @param {number} [z=0] Default z-value for 2D points.
 * @returns {THREE.Line} Line geometry for the supplied points.
 */
export function makeLine(points, color, z = 0) {
  const arr = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    arr[i * 3] = points[i][0];
    arr[i * 3 + 1] = points[i][1];
    arr[i * 3 + 2] = points[i][2] !== undefined ? points[i][2] : z;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return new THREE.Line(geom, new THREE.LineBasicMaterial({ color }));
}

/**
 * Builds a simple 2D arrow from a start point to an end point.
 * @param {number} sx Start x-coordinate.
 * @param {number} sy Start y-coordinate.
 * @param {number} ex End x-coordinate.
 * @param {number} ey End y-coordinate.
 * @param {number} color Three.js numeric color.
 * @param {number} headLen Arrowhead length in world units.
 * @returns {THREE.Group | null} Arrow group, or `null` for near-zero length arrows.
 */
export function makeArrow(sx, sy, ex, ey, color, headLen) {
  const dx = ex - sx,
    dy = ey - sy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return null;
  const hL = Math.min(headLen, len * 0.5);
  const hW = hL * 0.55;
  const nx = dx / len,
    ny = dy / len;
  const sex = ex - nx * hL,
    sey = ey - ny * hL;

  const group = new THREE.Group();
  group.add(
    makeLine(
      [
        [sx, sy],
        [sex, sey],
      ],
      color
    )
  );

  const px = -ny,
    py = nx;
  const headGeom = new THREE.BufferGeometry();
  headGeom.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        ex,
        ey,
        0,
        sex + px * hW,
        sey + py * hW,
        0,
        sex - px * hW,
        sey - py * hW,
        0,
      ]),
      3
    )
  );
  group.add(
    new THREE.Mesh(headGeom, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }))
  );
  return group;
}

/**
 * Builds a circular polyline approximation.
 * @param {number} cx Circle center x-coordinate.
 * @param {number} cy Circle center y-coordinate.
 * @param {number} r Circle radius.
 * @param {number} color Three.js numeric color.
 * @param {number} [segs=96] Number of line segments used for the approximation.
 * @returns {THREE.Line} Circular line geometry.
 */
export function makeCircleLine(cx, cy, r, color, segs = 96) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return makeLine(pts, color);
}

/**
 * Builds a filled circle mesh.
 * @param {number} cx Circle center x-coordinate.
 * @param {number} cy Circle center y-coordinate.
 * @param {number} r Circle radius.
 * @param {number} color Three.js numeric color.
 * @param {number} [z=0.05] Mesh z-position.
 * @returns {THREE.Mesh} Filled circle mesh.
 */
export function makeFilledCircle(cx, cy, r, color, z = 0.05) {
  const geom = new THREE.CircleGeometry(r, 28);
  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(cx, cy, z);
  return mesh;
}

/**
 * Builds an arc as a polyline between two angles.
 * @param {number} cx Arc center x-coordinate.
 * @param {number} cy Arc center y-coordinate.
 * @param {number} r Arc radius.
 * @param {number} a0 Start angle in radians.
 * @param {number} a1 End angle in radians.
 * @param {number} color Three.js numeric color.
 * @param {number} [segs=48] Number of line segments used for the approximation.
 * @returns {THREE.Line} Arc line geometry.
 */
export function makeArc(cx, cy, r, a0, a1, color, segs = 48) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (i / segs) * (a1 - a0);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return makeLine(pts, color);
}

/**
 * Create a dashed line between two points in 3D space.
 * @param {Point3Like} p1 Starting point.
 * @param {Point3Like} p2 Ending point.
 * @param {number} color Three.js numeric color.
 * @param {number} dashSize Length of each dash.
 * @param {number} gapSize Length of each gap.
 * @param {{opacity?: number, z?: number}} [opts={}] Additional material and z-position options.
 * @returns {THREE.Line} A THREE.Line object representing the dashed line.
 */
export function makeDashedLine(p1, p2, color, dashSize, gapSize, opts = {}) {
  const { opacity = 1, z = 0 } = opts;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        p1[0],
        p1[1],
        p1[2] !== undefined ? p1[2] : z,
        p2[0],
        p2[1],
        p2[2] !== undefined ? p2[2] : z,
      ]),
      3
    )
  );
  const mat = new THREE.LineDashedMaterial({
    color,
    dashSize,
    gapSize,
    transparent: opacity < 1,
    opacity,
  });
  const line = new THREE.Line(geom, mat);
  line.computeLineDistances();
  return line;
}

/**
 * Create a camera-facing text sprite.
 * @param {string} text The text to display.
 * @param {number} x The x-coordinate in world space.
 * @param {number} y The y-coordinate in world space.
 * @param {{color: string, italic?: boolean, worldHeight?: number, z?: number}} [opts={}] Options for the label.
 * @returns {THREE.Sprite} A THREE.Sprite object representing the label, positioned at (x, y) in world space.
 */
export function makeLabel(text, x, y, opts = {}) {
  const { color, italic = true, worldHeight = 0.13, z = 0.3 } = opts;
  const fontSize = 64;
  const padding = 8;
  const fontFamily = '"Cambria Math", Cambria, "Times New Roman", serif';
  const font = `${italic ? 'italic' : 'normal'} 500 ${fontSize}px ${fontFamily}`;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(text).width);
  const th = Math.ceil(fontSize * 1.25);
  canvas.width = tw + padding * 2;
  canvas.height = th + padding * 2;

  // Resizing the canvas resets context state — re-set the font.
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  sprite.position.set(x, y, z);
  return sprite;
}

/**
 * Create a camera-facing text sprite with individually colored segments.
 * @param {{text: string, color: string, italic?: boolean}[]} parts Label segments.
 * @param {number} x The x-coordinate in world space.
 * @param {number} y The y-coordinate in world space.
 * @param {{worldHeight?: number, z?: number}} [opts={}] Options for the label.
 * @returns {THREE.Sprite} A THREE.Sprite object representing the segmented label.
 */
export function makeSegmentedLabel(parts, x, y, opts = {}) {
  const { worldHeight = 0.13, z = 0.3 } = opts;
  const fontSize = 64;
  const padding = 8;
  const gap = 2;
  const fontFamily = '"Cambria Math", Cambria, "Times New Roman", serif';
  const normalWeight = 500;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const widths = parts.map((part) => {
    const font = `${part.italic ? 'italic' : 'normal'} ${normalWeight} ${fontSize}px ${fontFamily}`;
    ctx.font = font;
    return Math.ceil(ctx.measureText(part.text).width);
  });

  const totalTextWidth =
    widths.reduce((sum, w) => sum + w, 0) + Math.max(parts.length - 1, 0) * gap;
  const th = Math.ceil(fontSize * 1.25);
  canvas.width = totalTextWidth + padding * 2;
  canvas.height = th + padding * 2;

  // Resizing the canvas resets context state.
  ctx.textBaseline = 'middle';
  let cursor = padding;
  const cy = canvas.height / 2;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const font = `${part.italic ? 'italic' : 'normal'} ${normalWeight} ${fontSize}px ${fontFamily}`;
    ctx.font = font;
    ctx.fillStyle = part.color;
    ctx.textAlign = 'left';
    ctx.fillText(part.text, cursor, cy);
    cursor += widths[i] + gap;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  sprite.position.set(x, y, z);
  return sprite;
}

/**
 * Convert canvas pixel coordinates to world coordinates for an orthographic camera.
 * @param {HTMLCanvasElement} canvas The canvas element.
 * @param {THREE.OrthographicCamera} cam The orthographic camera.
 * @param {number} clientX The x-coordinate of the pointer in client (pixel) space.
 * @param {number} clientY The y-coordinate of the pointer in client (pixel) space.
 * @returns {{x: number, y: number}} The corresponding world coordinates.
 */
export function canvasToWorld(canvas, cam, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const wx = (cam.left + cam.right) / 2 + (ndcX * (cam.right - cam.left)) / 2;
  const wy = (cam.top + cam.bottom) / 2 + (ndcY * (cam.top - cam.bottom)) / 2;
  return { x: wx, y: wy };
}
