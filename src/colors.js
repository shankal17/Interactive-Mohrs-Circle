/**
 * Numeric color palette used by three.js materials.
 * @type {Record<string, number>}
 */
export const COLORS = {
  // Stress arrows
  TENSION: 0x4ade80,
  COMPRESSION: 0xef4444,
  SHEAR: 0xfbbf24,

  // Element scene
  REF_AXIS: 0x303030,
  OUTLINE: 0xdedede,
  FILL: 0x2a3a52,
  LOCAL_AXIS: 0x808080,

  // Mohr scene
  AXIS: 0x4a4a4a,
  CIRCLE: 0xeeeeee,
  DIAMETER: 0x4ade80,
  X_POINT: 0xfbbf24,
  Y_POINT: 0x60a5fa,
  X_INITIAL: 0x664400,
  PRINCIPAL: 0x9ca3af,
  CENTER: 0xaaaaaa,

  // Shared
  ARC: 0xa855f7,

  // Text-only variants — slightly brighter than their line counterparts so
  // small label text stays legible on the dark canvas / panel backgrounds.
  ARC_TEXT: 0xc084fc,
  AXIS_TEXT: 0x888888,
  LOCAL_TEXT: 0xbbbbbb,
};

/**
 * Converts a numeric RGB value into a CSS hex string.
 * @param {number} n Numeric RGB color.
 * @returns {string} CSS hex color string.
 */
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/**
 * CSS-string mirror of the shared color palette.
 * @type {Record<string, string>}
 */
export const CSS = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, hex(v)]));
