import * as THREE from 'three';
import { COLORS, CSS } from './colors.js';
import { rotatedStress } from './stress.js';
import {
  disposeChildren,
  makeLine,
  makeArrow,
  makeArc,
  makeLabel,
  canvasToWorld,
} from './three-helpers.js';

const VIEW_HALF_HEIGHT = 1.5; // world units; element is unit square

/** @typedef {import('./stress.js').StressState} StressState */

/**
 * Renders the rotating stress element view.
 */
export class ElementScene {
  /**
   * @param {HTMLCanvasElement} canvas Target canvas for the scene.
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -VIEW_HALF_HEIGHT,
      VIEW_HALF_HEIGHT,
      VIEW_HALF_HEIGHT,
      -VIEW_HALF_HEIGHT,
      0.1,
      10
    );
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(0x0e0e0e);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.staticGroup = new THREE.Group();
    this.rotorGroup = new THREE.Group();
    this.scene.add(this.staticGroup, this.rotorGroup);
  }

  /**
   * Converts a pointer position in client coordinates to world coordinates.
   * @param {number} clientX Pointer x-position in client space.
   * @param {number} clientY Pointer y-position in client space.
   * @returns {{x: number, y: number}} World coordinates under the pointer.
   */
  pointerToWorld(clientX, clientY) {
    return canvasToWorld(this.canvas, this.camera, clientX, clientY);
  }

  /**
   * Resizes the renderer and updates the orthographic frustum to match the canvas.
   * @returns {void}
   */
  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const sz = this.renderer.getSize(new THREE.Vector2());
    if (sz.x !== w || sz.y !== h) this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(h, 1);
    this.camera.left = -VIEW_HALF_HEIGHT * aspect;
    this.camera.right = VIEW_HALF_HEIGHT * aspect;
    this.camera.top = VIEW_HALF_HEIGHT;
    this.camera.bottom = -VIEW_HALF_HEIGHT;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Rebuilds the element scene for the current stress state.
   * @param {StressState} state Current stress state, including `theta`.
   * @returns {void}
   */
  update(state) {
    this.resize();
    this._buildStatic(state);
    this._buildRotor(state);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Builds the fixed reference axes and angle annotations.
   * @param {StressState} state Current stress state, including `theta`.
   * @returns {void}
   * @private
   */
  _buildStatic(state) {
    disposeChildren(this.staticGroup);
    const L = 1.4;
    this.staticGroup.add(
      makeLine(
        [
          [-L, 0],
          [L, 0],
        ],
        COLORS.REF_AXIS
      )
    );
    this.staticGroup.add(
      makeLine(
        [
          [0, -L],
          [0, L],
        ],
        COLORS.REF_AXIS
      )
    );

    this.staticGroup.add(
      makeLabel('x', L + 0.06, -0.1, { worldHeight: 0.2, color: CSS.AXIS_TEXT })
    );
    this.staticGroup.add(makeLabel('y', 0.1, L, { worldHeight: 0.2, color: CSS.AXIS_TEXT }));

    if (Math.abs(state.theta) > 0.005) {
      this.staticGroup.add(makeArc(0, 0, 0.32, 0, state.theta, COLORS.ARC, 48));
    }
    if (Math.abs(state.theta) > 0.18) {
      const lr = 0.4;
      this.staticGroup.add(
        makeLabel('θ', lr * Math.cos(state.theta / 2), lr * Math.sin(state.theta / 2), {
          worldHeight: 0.2,
          color: CSS.ARC_TEXT,
        })
      );
    }
  }

  /**
   * Builds the rotating element, local axes, and face stress arrows.
   * @param {StressState} state Current stress state, including `theta`.
   * @returns {void}
   * @private
   */
  _buildRotor(state) {
    disposeChildren(this.rotorGroup);

    // Square fill
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: COLORS.FILL,
        transparent: true,
        opacity: 0.55,
      })
    );
    fill.position.z = -0.05;
    this.rotorGroup.add(fill);

    // Outline
    this.rotorGroup.add(
      makeLine(
        [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, 0.5],
          [-0.5, 0.5],
          [-0.5, -0.5],
        ],
        COLORS.OUTLINE
      )
    );

    // Local x' & y' axis indicators
    const ax = makeArrow(0, 0, 0.28, 0, COLORS.LOCAL_AXIS, 0.05);
    const ay = makeArrow(0, 0, 0, 0.28, COLORS.LOCAL_AXIS, 0.05);
    if (ax) this.rotorGroup.add(ax);
    if (ay) this.rotorGroup.add(ay);

    // Local axis labels
    this.rotorGroup.add(makeLabel("x'", 0.34, 0.1, { worldHeight: 0.18, color: CSS.LOCAL_TEXT }));
    this.rotorGroup.add(makeLabel("y'", 0.1, 0.34, { worldHeight: 0.18, color: CSS.LOCAL_TEXT }));

    // Stress arrows on each face
    const { sxp, syp, txp } = rotatedStress(state.theta, state);
    const maxS = Math.max(
      Math.abs(state.sigmaX),
      Math.abs(state.sigmaY),
      Math.abs(state.tauXY),
      0.01
    );
    const scale = 0.55 / maxS;
    const HEAD = 0.08;

    const drawNormal = (cx, cy, nx, ny, val) => {
      if (Math.abs(val) < 0.01) return;
      const len = Math.abs(val) * scale;
      const a =
        val > 0
          ? makeArrow(cx, cy, cx + nx * len, cy + ny * len, COLORS.TENSION, HEAD)
          : makeArrow(cx + nx * len, cy + ny * len, cx, cy, COLORS.COMPRESSION, HEAD);
      if (a) this.rotorGroup.add(a);
    };
    const drawShear = (cx, cy, tx, ty, val) => {
      if (Math.abs(val) < 0.01) return;
      const len = Math.abs(val) * scale;
      const s = Math.sign(val);
      const a = makeArrow(cx, cy, cx + s * tx * len, cy + s * ty * len, COLORS.SHEAR, HEAD);
      if (a) this.rotorGroup.add(a);
    };

    // Right (+x') face
    drawNormal(0.5, 0, 1, 0, sxp);
    drawShear(0.5, 0, 0, 1, txp);
    // Top (+y') face
    drawNormal(0, 0.5, 0, 1, syp);
    drawShear(0, 0.5, 1, 0, txp);
    // Left (−x') face
    drawNormal(-0.5, 0, -1, 0, sxp);
    drawShear(-0.5, 0, 0, -1, txp);
    // Bottom (−y') face
    drawNormal(0, -0.5, 0, -1, syp);
    drawShear(0, -0.5, -1, 0, txp);

    this.rotorGroup.rotation.z = state.theta;
  }
}
