/**
 * Stress state at the reference element orientation.
 * @typedef {object} StressState
 * @property {number} sigmaX Normal stress on the x-face.
 * @property {number} sigmaY Normal stress on the y-face.
 * @property {number} tauXY Shear stress at the reference orientation.
 * @property {number} [theta] Element rotation in radians.
 */

/**
 * Transformed stress components on the rotated element.
 * @typedef {object} RotatedStress
 * @property {number} sxp Normal stress on the rotated x'-face.
 * @property {number} syp Normal stress on the rotated y'-face.
 * @property {number} txp Shear stress on the rotated x'-face.
 */

/**
 * Circle center and radius for the current 2D stress state.
 * @typedef {object} MohrParameters
 * @property {number} cx Normal-stress coordinate of the circle center.
 * @property {number} r Circle radius.
 */

/**
 * Computes the transformed stress components for a rotated 2D element.
 * @param {number} theta Element rotation in radians.
 * @param {StressState} state Reference stress state.
 * @returns {RotatedStress} Stress components on the rotated faces.
 */
export function rotatedStress(theta, { sigmaX, sigmaY, tauXY }) {
  const avg = (sigmaX + sigmaY) / 2;
  const diff = (sigmaX - sigmaY) / 2;
  const c = Math.cos(2 * theta);
  const s = Math.sin(2 * theta);
  return {
    sxp: avg + diff * c + tauXY * s,
    syp: avg - diff * c - tauXY * s,
    txp: -diff * s + tauXY * c,
  };
}

/**
 * Computes the center and radius of Mohr's circle.
 * @param {StressState} state Reference stress state.
 * @returns {MohrParameters} Circle center and radius.
 */
export function mohrParams({ sigmaX, sigmaY, tauXY }) {
  return {
    cx: (sigmaX + sigmaY) / 2,
    r: Math.sqrt(((sigmaX - sigmaY) / 2) ** 2 + tauXY ** 2),
  };
}

/**
 * Computes the principal-direction angle in the element frame.
 * @param {StressState} state Reference stress state.
 * @returns {number} Principal angle in radians.
 */
export function principalAngle({ sigmaX, sigmaY, tauXY }) {
  return 0.5 * Math.atan2(2 * tauXY, sigmaX - sigmaY);
}

/**
 * Computes the initial Mohr-circle angle for the X-face point.
 * @param {StressState} state Reference stress state.
 * @returns {number} Angle from the circle center in radians.
 */
export function initialMohrAngle({ sigmaX, sigmaY, tauXY }) {
  return Math.atan2(tauXY, (sigmaX - sigmaY) / 2);
}
