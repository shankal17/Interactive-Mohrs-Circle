import * as THREE from 'three';
import { COLORS, CSS } from './colors.js';
import { rotatedStress, mohrParams, initialMohrAngle } from './stress.js';
import {
  disposeChildren,
  makeLine,
  makeCircleLine,
  makeFilledCircle,
  makeArc,
  makeLabel,
  makeSegmentedLabel,
  makeDashedLine,
  canvasToWorld,
} from './three-helpers.js';

/**
 * @typedef {import('./stress.js').StressState} StressState
 */

/**
 * Renders the Mohr's-circle view for the current 2D stress state.
 */
export class MohrScene {
  /**
   * @param {HTMLCanvasElement} canvas Target canvas for the scene.
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 10);
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(0x0e0e0e);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Increase these to create more camera margin around the Mohr circle.
    this.fitPaddingScale = 0.75;
    this.fitPaddingMin = 12;

    this._labelState = {
      x: null,
      y: null,
    };
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
   * Resizes the renderer to match the canvas size.
   * @returns {void}
   */
  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const sz = this.renderer.getSize(new THREE.Vector2());
    if (sz.x !== w || sz.y !== h) this.renderer.setSize(w, h, false);
    // Camera frustum is set inside update() — depends on data.
  }

  /**
   * Rebuilds the Mohr's-circle scene for the current stress state.
   * @param {StressState} state Current stress state, including `theta`.
   * @returns {void}
   */
  update(state) {
    this.resize();
    disposeChildren(this.group);

    const { cx, r } = mohrParams(state);
    this._fitCamera(cx, r);

    const viewW = this.camera.right - this.camera.left;
    const viewH = this.camera.top - this.camera.bottom;
    const ptR = viewW * 0.008;
    const labelSize = Math.min(viewW, viewH) * 0.07;
    const margin = Math.min(viewW, viewH) * 0.04;

    // σ and τ axes
    this.group.add(
      makeLine(
        [
          [this.camera.left, 0],
          [this.camera.right, 0],
        ],
        COLORS.AXIS
      )
    );
    this.group.add(
      makeLine(
        [
          [0, this.camera.bottom],
          [0, this.camera.top],
        ],
        COLORS.AXIS
      )
    );
    this.group.add(
      makeLabel('σ', this.camera.right - margin * 1.5, margin * 1.0, {
        worldHeight: labelSize,
        color: CSS.AXIS_TEXT,
      })
    );
    this.group.add(
      makeLabel('τ', margin * 1.0, this.camera.top - margin * 1.5, {
        worldHeight: labelSize,
        color: CSS.AXIS_TEXT,
      })
    );

    // Degenerate case: hydrostatic stress, circle collapses to a point
    if (r < 1e-3) {
      this.group.add(makeFilledCircle(cx, 0, ptR * 1.6, COLORS.X_POINT));
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Circle, center, principal markers
    this.group.add(makeCircleLine(cx, 0, r, COLORS.CIRCLE));
    this.group.add(makeFilledCircle(cx, 0, ptR * 0.6, COLORS.CENTER));
    this.group.add(makeFilledCircle(cx + r, 0, ptR * 1.1, COLORS.PRINCIPAL));
    this.group.add(makeFilledCircle(cx - r, 0, ptR * 1.1, COLORS.PRINCIPAL));
    this.group.add(
      makeLabel('σ₁', cx + r + margin * 1.1, margin * 1.1, {
        worldHeight: labelSize * 0.95,
        color: CSS.PRINCIPAL,
      })
    );
    this.group.add(
      makeLabel('σ₂', cx - r - margin * 1.1, margin * 1.1, {
        worldHeight: labelSize * 0.95,
        color: CSS.PRINCIPAL,
      })
    );

    // Faded reference: where X sat at θ = 0
    this.group.add(makeFilledCircle(state.sigmaX, state.tauXY, ptR * 0.9, COLORS.X_INITIAL, 0.04));

    // Diameter through current X & Y
    const { sxp, syp, txp } = rotatedStress(state.theta, state);
    this.group.add(
      makeLine(
        [
          [sxp, txp],
          [syp, -txp],
        ],
        COLORS.DIAMETER
      )
    );

    const dash = labelSize * 0.3;
    const gap = labelSize * 0.18;
    const projDashOpts = { opacity: 0.7, z: 0.02 };
    const normalColor = (v) => (v >= 0 ? COLORS.TENSION : COLORS.COMPRESSION);
    const normalColorCss = (v) => (v >= 0 ? CSS.TENSION : CSS.COMPRESSION);

    // X-face projections (σx' down to σ-axis, τx'y' across to τ-axis)
    this.group.add(makeDashedLine([sxp, txp], [sxp, 0], normalColor(sxp), dash, gap, projDashOpts));
    this.group.add(makeDashedLine([sxp, txp], [0, txp], COLORS.SHEAR, dash, gap, projDashOpts));

    // Y-face projections (σy' down to σ-axis, −τx'y' across to τ-axis)
    this.group.add(
      makeDashedLine([syp, -txp], [syp, 0], normalColor(syp), dash, gap, projDashOpts)
    );
    this.group.add(makeDashedLine([syp, -txp], [0, -txp], COLORS.SHEAR, dash, gap, projDashOpts));

    // 2θ arc (sweeps backward from φ₀ for positive θ — see stress.js)
    const phi0 = initialMohrAngle(state);
    const phi = phi0 - 2 * state.theta;
    if (Math.abs(state.theta) > 0.005) {
      this.group.add(makeArc(cx, 0, r * 0.28, phi0, phi, COLORS.ARC, 64));
    }
    if (Math.abs(state.theta) > 0.18) {
      const midAng = phi0 - state.theta;
      const lr = r * 0.4;
      this.group.add(
        makeLabel('2θ', cx + lr * Math.cos(midAng), lr * Math.sin(midAng), {
          worldHeight: labelSize * 0.85,
          color: CSS.ARC_TEXT,
        })
      );
    }

    // Conjugate Y point, then current X on top
    this.group.add(makeFilledCircle(syp, -txp, ptR * 1.5, COLORS.Y_POINT, 0.1));
    this.group.add(makeFilledCircle(sxp, txp, ptR * 1.8, COLORS.X_POINT, 0.15));

    // X / Y coordinate labels with smart placement around each point.
    // Try several candidate offsets and pick the one with the lowest overlap cost.
    const coordLabelHeight = labelSize * 0.95;
    const estimateLabelWidth = (parts, worldHeight) => {
      const chars = parts.reduce((sum, part) => sum + part.text.length, 0);
      return worldHeight * (0.62 * chars + 1.8);
    };
    const estimateLabelHeight = (worldHeight) => worldHeight * 1.1;

    /**
     * @param {number} px
     * @param {number} py
     * @returns {[number, number]} Unit vector from center to point.
     */
    const outwardUnit = (px, py) => {
      const vx = px - cx;
      const vy = py;
      const n = Math.hypot(vx, vy);
      if (n < 1e-6) return [1, 0];
      return [vx / n, vy / n];
    };

    /**
     * @param {{text: string, color: string, italic?: boolean}[]} parts
     * @param {number} px
     * @param {number} py
     * @param {{x: number, y: number, halfW: number, halfH: number} | null} other
     * @returns {{x: number, y: number, halfW: number, halfH: number}}
     */
    const pickLabelPosition = (parts, px, py, other = null) => {
      const [ux, uy] = outwardUnit(px, py);
      const tx = -uy;
      const ty = ux;

      const halfW = estimateLabelWidth(parts, coordLabelHeight) / 2;
      const halfH = estimateLabelHeight(coordLabelHeight) / 2;

      const dNear = labelSize * 1.8;
      const dMid = labelSize * 2.45;
      const dFar = labelSize * 3.2;
      const tShift = labelSize * 1.35;

      const candidates = [
        [px + ux * dMid, py + uy * dMid],
        [px + ux * dNear + tx * tShift, py + uy * dNear + ty * tShift],
        [px + ux * dNear - tx * tShift, py + uy * dNear - ty * tShift],
        [px + ux * dFar, py + uy * dFar],
        [px + ux * dMid + tx * (tShift * 1.35), py + uy * dMid + ty * (tShift * 1.35)],
        [px + ux * dMid - tx * (tShift * 1.35), py + uy * dMid - ty * (tShift * 1.35)],
      ];

      const axisClear = labelSize * 0.65;
      const edgePad = labelSize * 0.4;

      /** @param {number} x @param {number} y */
      const score = (x, y) => {
        let s = 0;

        // Keep labels outside the circle body.
        const centerDist = Math.hypot(x - cx, y);
        const minOutside = r + halfH * 1.1;
        if (centerDist < minOutside) s += (minOutside - centerDist) * 300;

        // Avoid axis lines where clutter is high.
        s += Math.max(0, axisClear - Math.abs(y)) * 85;
        s += Math.max(0, axisClear - Math.abs(x)) * 45;

        // Penalize overflow outside view.
        const left = this.camera.left + edgePad + halfW;
        const right = this.camera.right - edgePad - halfW;
        const bottom = this.camera.bottom + edgePad + halfH;
        const top = this.camera.top - edgePad - halfH;
        if (x < left) s += (left - x) * 220;
        if (x > right) s += (x - right) * 220;
        if (y < bottom) s += (bottom - y) * 220;
        if (y > top) s += (y - top) * 220;

        // Keep labels separated.
        if (other) {
          const minDx = halfW + other.halfW + labelSize * 0.25;
          const minDy = halfH + other.halfH + labelSize * 0.2;
          const ox = Math.max(0, minDx - Math.abs(x - other.x));
          const oy = Math.max(0, minDy - Math.abs(y - other.y));
          s += ox * oy * 120;
        }

        // Keep somewhat near the point so association stays obvious.
        s += Math.hypot(x - px, y - py) * 0.35;
        return s;
      };

      let best = candidates[0];
      let bestScore = Number.POSITIVE_INFINITY;
      for (const [x, y] of candidates) {
        const sc = score(x, y);
        if (sc < bestScore) {
          bestScore = sc;
          best = [x, y];
        }
      }

      return { x: best[0], y: best[1], halfW, halfH };
    };

    const xParts = [
      { text: 'X (', color: CSS.X_POINT, italic: false },
      { text: sxp.toFixed(2), color: normalColorCss(sxp), italic: false },
      { text: ', ', color: CSS.X_POINT, italic: false },
      { text: txp.toFixed(2), color: CSS.SHEAR, italic: false },
      { text: ')', color: CSS.X_POINT, italic: false },
    ];
    const yParts = [
      { text: 'Y (', color: CSS.Y_POINT, italic: false },
      { text: syp.toFixed(2), color: normalColorCss(syp), italic: false },
      { text: ', ', color: CSS.Y_POINT, italic: false },
      { text: (-txp).toFixed(2), color: CSS.SHEAR, italic: false },
      { text: ')', color: CSS.Y_POINT, italic: false },
    ];

    const xLabelPos = pickLabelPosition(xParts, sxp, txp, null);
    const yLabelPos = pickLabelPosition(yParts, syp, -txp, xLabelPos);

    const xLabelDrawPos = this._smoothLabelPosition('x', xLabelPos.x, xLabelPos.y, labelSize);
    const yLabelDrawPos = this._smoothLabelPosition('y', yLabelPos.x, yLabelPos.y, labelSize);

    this.group.add(
      makeSegmentedLabel(xParts, xLabelDrawPos.x, xLabelDrawPos.y, {
        worldHeight: coordLabelHeight,
      })
    );
    this.group.add(
      makeSegmentedLabel(yParts, yLabelDrawPos.x, yLabelDrawPos.y, {
        worldHeight: coordLabelHeight,
      })
    );

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Fits the orthographic camera around the visible Mohr-circle geometry.
   * @param {number} cx Circle center on the normal-stress axis.
   * @param {number} r Circle radius.
   * @returns {void}
   * @private
   */
  _fitCamera(cx, r) {
    const padding = Math.max(r * this.fitPaddingScale, this.fitPaddingMin);
    const xMin = Math.min(cx - r, 0) - padding;
    const xMax = Math.max(cx + r, 0) + padding;
    const yMin = -r - padding;
    const yMax = r + padding;

    const w = xMax - xMin;
    const h = yMax - yMin;
    const aspect = this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1);
    const tAspect = w / Math.max(h, 1e-6);

    let viewW, viewH;
    if (tAspect > aspect) {
      viewW = w;
      viewH = w / aspect;
    } else {
      viewH = h;
      viewW = h * aspect;
    }

    const cxView = (xMin + xMax) / 2;
    const cyView = (yMin + yMax) / 2;
    this.camera.left = cxView - viewW / 2;
    this.camera.right = cxView + viewW / 2;
    this.camera.bottom = cyView - viewH / 2;
    this.camera.top = cyView + viewH / 2;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Smoothly interpolates a label from its previous position to a new target.
   * @param {'x' | 'y'} key Label identifier.
   * @param {number} tx Target x-position.
   * @param {number} ty Target y-position.
   * @param {number} scale Scene scale used to tune interpolation speed.
   * @returns {{x: number, y: number}} Smoothed draw position.
   * @private
   */
  _smoothLabelPosition(key, tx, ty, scale) {
    const prev = this._labelState[key];
    if (!prev) {
      const start = { x: tx, y: ty };
      this._labelState[key] = start;
      
      return start;
    }

    const dx = tx - prev.x;
    const dy = ty - prev.y;
    const dist = Math.hypot(dx, dy);

    // Ease toward target; move faster only when target jumped far away.
    const alpha = dist > scale * 2.2 ? 0.34 : 0.2;
    prev.x += dx * alpha;
    prev.y += dy * alpha;

    return prev;
  }
}
