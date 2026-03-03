/**
 * Sistema de cores com variações tonais
 * Gera 15 cores base com 12 variações cada (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950)
 */

// 15 cores base em HSL (hue, saturation)
const BASE_COLORS = {
  slate: [220, 13],
  gray: [0, 0],
  zinc: [0, 0],
  neutral: [0, 0],
  stone: [12, 12],
  red: [0, 84],
  orange: [32, 98],
  amber: [38, 92],
  yellow: [48, 97],
  lime: [84, 85],
  green: [142, 76],
  emerald: [160, 84],
  teal: [174, 83],
  cyan: [189, 89],
  blue: [217, 91],
  indigo: [226, 86],
  violet: [259, 84],
  purple: [280, 85],
  pink: [326, 85],
};

const TONAL_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Mapeamento de stops para valores de lightness
const LIGHTNESS_MAP = {
  50: 97,
  100: 93,
  200: 86,
  300: 77,
  400: 66,
  500: 50,
  600: 40,
  700: 30,
  800: 22,
  900: 11,
  950: 6,
};

// Mapeamento de stops para saturação
const SATURATION_MAP = {
  50: 100,
  100: 100,
  200: 97,
  300: 94,
  400: 89,
  500: 84,
  600: 74,
  700: 73,
  800: 78,
  900: 84,
  950: 88,
};

/**
 * Converte HSL para HEX
 */
function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Gera variações tonais para uma cor base
 */
function generateColorVariations(hue, baseSaturation) {
  const variations = {};

  TONAL_STOPS.forEach((stop) => {
    const lightness = LIGHTNESS_MAP[stop];
    const saturation = Math.max(0, baseSaturation * (SATURATION_MAP[stop] / 84));
    variations[stop] = hslToHex(hue, saturation, lightness);
  });

  return variations;
}

/**
 * Gera o sistema completo de cores
 */
export function generateColorSystem() {
  const system = {};

  Object.entries(BASE_COLORS).forEach(([colorName, [hue, saturation]]) => {
    system[colorName] = generateColorVariations(hue, saturation);
  });

  return system;
}

/**
 * Retorna cores em formato flat para uso direto
 */
export function getFlatColorPalette() {
  const system = generateColorSystem();
  const flat = {};

  Object.entries(system).forEach(([colorName, variations]) => {
    Object.entries(variations).forEach(([stop, hex]) => {
      flat[`${colorName}-${stop}`] = hex;
    });
  });

  return flat;
}

/**
 * Retorna apenas as cores 500 (principais) de cada cor
 */
export function getPrimaryColors() {
  const system = generateColorSystem();
  const primary = {};

  Object.entries(system).forEach(([colorName, variations]) => {
    primary[colorName] = variations[500];
  });

  return primary;
}

/**
 * Retorna cores agrupadas para o picker de cores (formato de grupos)
 */
export function getColorGroupsForPicker() {
  const system = generateColorSystem();
  const groups = [];

  Object.entries(system).forEach(([colorName, variations]) => {
    const group = TONAL_STOPS.map((stop) => variations[stop]);
    groups.push({ name: colorName, colors: group });
  });

  return groups;
}

export default generateColorSystem;