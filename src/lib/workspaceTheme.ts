/**
 * Generates a 50–900 color scale from a single base hex color and injects it
 * as CSS custom properties, so a Workspace's `brand.primaryColor` themes the
 * whole renderer at runtime — one hex value per product, no Portal rebuild,
 * ported from BGrowth Studio's src/engine/theme.ts (same algorithm, so a
 * product looks identical whether previewed in Studio or opened here).
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mix(a: Rgb, b: Rgb, ratio: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * ratio),
    g: Math.round(a.g + (b.g - a.g) * ratio),
    b: Math.round(a.b + (b.b - a.b) * ratio),
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Shade -> how much to mix toward white (positive) or black (negative). */
const SHADE_RATIOS: Record<number, number> = {
  50: 0.92,
  100: 0.83,
  200: 0.66,
  300: 0.48,
  400: 0.26,
  500: 0,
  600: -0.14,
  700: -0.28,
  800: -0.42,
  900: -0.56,
};

export function generateWorkspaceColorScale(baseHex: string): Record<number, string> {
  const base = hexToRgb(baseHex);
  const scale: Record<number, string> = {};
  for (const [shade, ratio] of Object.entries(SHADE_RATIOS)) {
    const target = ratio >= 0 ? WHITE : BLACK;
    const mixed = ratio === 0 ? base : mix(base, target, Math.abs(ratio));
    scale[Number(shade)] = `${mixed.r} ${mixed.g} ${mixed.b}`;
  }
  return scale;
}

/** Sets --color-workspace-{shade} custom properties on the given element (defaults to <html>). */
export function applyWorkspaceTheme(baseHex: string, target: HTMLElement = document.documentElement): void {
  const scale = generateWorkspaceColorScale(baseHex);
  for (const [shade, rgbTriplet] of Object.entries(scale)) {
    target.style.setProperty(`--color-workspace-${shade}`, rgbTriplet);
  }
}
