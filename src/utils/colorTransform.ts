export function applyColorTransform(
  imageData: ImageData,
  bgColor: [number, number, number],
  fgColor: [number, number, number],
): ImageData {
  const data = imageData.data;
  const [br, bg, bb] = bgColor;
  const [fr, fg, ff] = fgColor;

  // Precompute per-channel lookup tables indexed by source luminance (0..255).
  // Each luminance maps to a smooth blend between bg and fg, so anti-aliased
  // (gray) edge pixels stay smooth instead of snapping to a hard threshold and
  // destroying the glyph edges (the old "hard threshold" approach left gray
  // edge pixels untouched or snapped them, which looked blurry on low-res PDFs).
  const rLUT = new Uint8ClampedArray(256);
  const gLUT = new Uint8ClampedArray(256);
  const bLUT = new Uint8ClampedArray(256);
  for (let lum = 0; lum < 256; lum++) {
    const coverage = (255 - lum) / 255; // 0 = background (white), 1 = foreground (black)
    rLUT[lum] = Math.round(br + (fr - br) * coverage);
    gLUT[lum] = Math.round(bg + (fg - bg) * coverage);
    bLUT[lum] = Math.round(bb + (ff - bb) * coverage);
  }

  const view = new Uint32Array(data.buffer, data.byteOffset, data.length >> 2);
  const len = view.length;

  for (let i = 0; i < len; i++) {
    const px = view[i];
    const a = px >>> 24;
    if (a <= 128) continue;

    const r = px & 0xff;
    const g = (px >> 8) & 0xff;
    const b = (px >> 16) & 0xff;
    const lum = (76 * r + 150 * g + 29 * b) >> 8; // 0..255

    view[i] = (a << 24) | (bLUT[lum] << 16) | (gLUT[lum] << 8) | rLUT[lum];
  }

  return imageData;
}

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

export function darkenColor(hex: string, factor = 0.7): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const r = Math.round(((num >> 16) & 255) * factor);
  const g = Math.round(((num >> 8) & 255) * factor);
  const b = Math.round((num & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}
