export function applyColorTransform(
  imageData: ImageData,
  bgColor: [number, number, number],
  fgColor: [number, number, number],
): ImageData {
  const data = imageData.data;
  const [br, bg, bb] = bgColor;
  const [fr, fg, ff] = fgColor;
  const bgPx = 0xff000000 | (bb << 16) | (bg << 8) | br;
  const fgPx = 0xff000000 | (ff << 16) | (fg << 8) | fr;
  const view = new Uint32Array(data.buffer, data.byteOffset, data.length >> 2);
  const len = view.length;

  for (let i = 0; i < len; i++) {
    const px = view[i];
    const a = px >>> 24;
    if (a <= 128) continue;

    const r = px & 0xff;
    const g = (px >> 8) & 0xff;
    const b = (px >> 16) & 0xff;

    if (r > 200 && g > 200 && b > 200) {
      view[i] = bgPx;
    } else if (r < 55 && g < 55 && b < 55) {
      view[i] = fgPx;
    } else {
      const lum = (76 * r + 150 * g + 29 * b) >> 8;
      if (lum > 200) {
        view[i] = bgPx;
      } else if (lum < 55) {
        view[i] = fgPx;
      }
    }
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
