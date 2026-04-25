import { ElementScene } from './element-scene.js';
import { MohrScene } from './mohr-scene.js';
import { rotatedStress, mohrParams, principalAngle } from './stress.js';
import { CSS } from './colors.js';

/**
 * Chooses a readout color based on the sign of a normal stress value.
 * @param {number} v Normal stress value.
 * @returns {string} CSS color for tension or compression.
 */
const normalColor = (v) => (v >= 0 ? CSS.TENSION : CSS.COMPRESSION);

// Element state
/** @type {import('./stress.js').StressState} */
const state = {
  sigmaX: 60,
  sigmaY: -20,
  tauXY: 30,
  theta: 0, // radians
};

// DOM hooks
const inSx = document.getElementById('sigmaX');
const inSy = document.getElementById('sigmaY');
const inTau = document.getElementById('tauXY');
const inTheta = document.getElementById('thetaInput');
const btnReset = document.getElementById('resetBtn');

const dispTheta = document.getElementById('dispTheta');
const dispSxp = document.getElementById('dispSxp');
const dispSyp = document.getElementById('dispSyp');
const dispTxp = document.getElementById('dispTxp');
const dispSigma1 = document.getElementById('dispSigma1');
const dispSigma2 = document.getElementById('dispSigma2');
const dispTmax = document.getElementById('dispTmax');
const dispThetaS = document.getElementById('dispThetaS');

inSx.addEventListener('input', () => {
  state.sigmaX = parseFloat(inSx.value) || 0;
});
inSy.addEventListener('input', () => {
  state.sigmaY = parseFloat(inSy.value) || 0;
});
inTau.addEventListener('input', () => {
  state.tauXY = parseFloat(inTau.value) || 0;
});
inTheta.addEventListener('input', () => {
  state.theta = ((parseFloat(inTheta.value) || 0) * Math.PI) / 180;
});
btnReset.addEventListener('click', () => {
  state.theta = 0;
});

// Scenes
const elScene = new ElementScene(document.getElementById('elementCanvas'));
const mohrScene = new MohrScene(document.getElementById('mohrCanvas'));

// Pointer interactions
/**
 * Adds drag-to-rotate interactions to the stress element canvas.
 * @param {ElementScene} scene Element scene instance.
 * @param {import('./stress.js').StressState} state Shared application state.
 * @returns {void}
 */
function attachElementDrag(scene, state) {
  const canvas = scene.canvas;
  let dragging = false;
  let lastAng = 0;

  canvas.addEventListener('pointerdown', (e) => {
    const w = scene.pointerToWorld(e.clientX, e.clientY);
    if (Math.hypot(w.x, w.y) < 0.05) return; // ignore exact center
    dragging = true;
    lastAng = Math.atan2(w.y, w.x);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const w = scene.pointerToWorld(e.clientX, e.clientY);
    const ang = Math.atan2(w.y, w.x);
    let d = ang - lastAng;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    state.theta += d;
    lastAng = ang;
  });
  const stop = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

/**
 * Adds drag-to-rotate interactions to the Mohr-circle canvas.
 * @param {MohrScene} scene Mohr-circle scene instance.
 * @param {import('./stress.js').StressState} state Shared application state.
 * @returns {void}
 */
function attachMohrDrag(scene, state) {
  const canvas = scene.canvas;
  let dragging = false;
  let lastAng = 0;

  canvas.addEventListener('pointerdown', (e) => {
    const w = scene.pointerToWorld(e.clientX, e.clientY);
    const { cx, r } = mohrParams(state);
    if (r < 1e-3) return;
    const dist = Math.hypot(w.x - cx, w.y);
    if (dist > r * 2.5 || dist < r * 0.05) return;
    dragging = true;
    lastAng = Math.atan2(w.y, w.x - cx);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const w = scene.pointerToWorld(e.clientX, e.clientY);
    const { cx } = mohrParams(state);
    const ang = Math.atan2(w.y, w.x - cx);
    let d = ang - lastAng;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    state.theta -= d / 2;
    lastAng = ang;
  });
  const stop = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
}

attachElementDrag(elScene, state);
attachMohrDrag(mohrScene, state);

// Info/transformed state
/**
 * Updates the DOM readouts to reflect the current transformed stress state.
 * @returns {void}
 */
function updateInfo() {
  const { sxp, syp, txp } = rotatedStress(state.theta, state);
  const { cx, r } = mohrParams(state);
  const thetaDeg = (state.theta * 180) / Math.PI;
  const s1 = cx + r;
  const s2 = cx - r;
  const thetaS = (principalAngle(state) * 180) / Math.PI + 45;

  dispTheta.textContent = `${thetaDeg.toFixed(1)}°`;
  dispTheta.style.color = CSS.ARC_TEXT;

  dispSxp.textContent = sxp.toFixed(2);
  dispSxp.style.color = normalColor(sxp);

  dispSyp.textContent = syp.toFixed(2);
  dispSyp.style.color = normalColor(syp);

  dispTxp.textContent = txp.toFixed(2);
  dispTxp.style.color = CSS.SHEAR;

  dispSigma1.textContent = s1.toFixed(2);
  dispSigma1.style.color = normalColor(s1);

  dispSigma2.textContent = s2.toFixed(2);
  dispSigma2.style.color = normalColor(s2);

  dispTmax.textContent = r.toFixed(2);
  dispTmax.style.color = CSS.SHEAR;

  dispThetaS.textContent = `${thetaS.toFixed(1)}°`;
  dispThetaS.style.color = CSS.ARC_TEXT;

  // Don't fight the user if they're typing in the θ input.
  if (document.activeElement !== inTheta) {
    inTheta.value = thetaDeg.toFixed(1);
  }
}

// Animation loop
/**
 * Renders both scenes and refreshes the readout once per animation frame.
 * @returns {void}
 */
function tick() {
  elScene.update(state);
  mohrScene.update(state);
  updateInfo();
  requestAnimationFrame(tick);
}
tick();
