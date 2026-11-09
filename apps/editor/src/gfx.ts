// Zeichenhilfen für Canvas
import { smsToRgb, type Project } from '@sms/core';

export function paletteRgb(pal: number[]): [number, number, number][] {
  return Array.from({ length: 16 }, (_, i) => smsToRgb(pal[i] ?? 0));
}

/** Pixelbild (Palettenindex) in ImageData schreiben. transparent0 = Index 0 durchsichtig */
export function pixelsToImage(px: number[], w: number, h: number, pal: [number, number, number][], transparent0 = false): ImageData {
  const img = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const c = px[i] ?? 0;
    if (transparent0 && c === 0) continue;
    const [r, g, b] = pal[c];
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  return img;
}

/** Cache: Metatile-Index → Canvas 16×16 */
export function metatileCanvases(p: Project): HTMLCanvasElement[] {
  const pal = paletteRgb(p.palettes.bg);
  return p.metatiles.map((m) => {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    c.getContext('2d')!.putImageData(pixelsToImage(m.pixels, 16, 16, pal), 0, 0);
    return c;
  });
}

export function spriteCanvases(p: Project, id: string): HTMLCanvasElement[] {
  const s = p.sprites.find((x) => x.id === id);
  if (!s) return [];
  const pal = paletteRgb(p.palettes.sprite);
  return s.frames.map((f) => {
    const c = document.createElement('canvas');
    c.width = s.width; c.height = s.height;
    c.getContext('2d')!.putImageData(pixelsToImage(f, s.width, s.height, pal, true), 0, 0);
    return c;
  });
}

export function downloadBlob(data: BlobPart, name: string, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
