import { useEffect, useRef, useState } from 'react';
import { smsToCss } from '@sms/core';
import { paletteRgb, pixelsToImage } from '../gfx';

type Tool = 'pen' | 'fill' | 'pick' | 'line';

interface Props {
  pixels: number[];
  width: number;
  height: number;
  palette: number[];
  transparent0?: boolean;
  /** Raster für Tile-/Zellgrenzen */
  cellW?: number;
  cellH?: number;
  onChange: (px: number[]) => void;
}

/** Pixel-Zeichenfläche mit Stift, Linie, Füllen, Pipette. */
export function PixelEditor({ pixels, width, height, palette, transparent0, cellW = 8, cellH = 8, onChange }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(1);
  const [color2, setColor2] = useState(0);
  const [tool, setTool] = useState<Tool>('pen');
  const draft = useRef<number[] | null>(null);
  const start = useRef<{ x: number; y: number; c: number } | null>(null);
  const zoom = Math.max(4, Math.floor(384 / Math.max(width, height)));
  const [, force] = useState(0);

  const draw = (px: number[]) => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const pal = paletteRgb(palette);
    const tmp = document.createElement('canvas');
    tmp.width = width; tmp.height = height;
    tmp.getContext('2d')!.putImageData(pixelsToImage(px, width, height, pal, transparent0), 0, 0);
    ctx.imageSmoothingEnabled = false;
    // Transparenz-Schachbrett
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      ctx.fillStyle = (x + y) & 1 ? '#2b2b33' : '#383842';
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }
    ctx.drawImage(tmp, 0, 0, width * zoom, height * zoom);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    for (let x = 0; x <= width; x++) { ctx.moveTo(x * zoom + 0.5, 0); ctx.lineTo(x * zoom + 0.5, height * zoom); }
    for (let y = 0; y <= height; y++) { ctx.moveTo(0, y * zoom + 0.5); ctx.lineTo(width * zoom, y * zoom + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,0,0.45)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += cellW) { ctx.moveTo(x * zoom + 0.5, 0); ctx.lineTo(x * zoom + 0.5, height * zoom); }
    for (let y = 0; y <= height; y += cellH) { ctx.moveTo(0, y * zoom + 0.5); ctx.lineTo(width * zoom, y * zoom + 0.5); }
    ctx.stroke();
  };

  useEffect(() => { draw(pixels); });

  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) };
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  const line = (px: number[], x0: number, y0: number, x1: number, y1: number, c: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (inside(x, y)) px[y * width + x] = c;
    }
  };

  const fill = (px: number[], x: number, y: number, c: number) => {
    const from = px[y * width + x];
    if (from === c) return;
    const st = [[x, y]];
    while (st.length) {
      const [cx, cy] = st.pop()!;
      if (!inside(cx, cy) || px[cy * width + cx] !== from) continue;
      px[cy * width + cx] = c;
      st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y } = pos(e);
    if (!inside(x, y)) return;
    const c = e.button === 2 ? color2 : color;
    if (tool === 'pick') { (e.button === 2 ? setColor2 : setColor)(pixels[y * width + x]); return; }
    const px = [...pixels];
    if (tool === 'fill') { fill(px, x, y, c); onChange(px); return; }
    ref.current!.setPointerCapture(e.pointerId);
    start.current = { x, y, c };
    px[y * width + x] = c;
    draft.current = px;
    draw(px);
  };
  const move = (e: React.PointerEvent) => {
    if (!draft.current || !start.current) return;
    const { x, y } = pos(e);
    if (tool === 'line') {
      const px = [...pixels];
      line(px, start.current.x, start.current.y, x, y, start.current.c);
      draft.current = px;
    } else {
      line(draft.current, start.current.x, start.current.y, x, y, start.current.c);
      start.current = { ...start.current, x, y };
    }
    draw(draft.current);
  };
  const up = () => {
    if (draft.current) onChange(draft.current);
    draft.current = null;
    start.current = null;
    force((n) => n + 1);
  };

  return (
    <div className="pixel-editor">
      <div className="toolbar">
        {(['pen', 'line', 'fill', 'pick'] as Tool[]).map((t) => (
          <button key={t} className={tool === t ? 'active' : ''} onClick={() => setTool(t)} title={t}>
            {{ pen: '✎ Stift', line: '╱ Linie', fill: '◧ Füllen', pick: '⌖ Pipette' }[t]}
          </button>
        ))}
        <span className="sep" />
        <button onClick={() => onChange(flip(pixels, width, height, true))}>⇋ H</button>
        <button onClick={() => onChange(flip(pixels, width, height, false))}>⇵ V</button>
        <button onClick={() => onChange(shift(pixels, width, height, -1, 0))}>←</button>
        <button onClick={() => onChange(shift(pixels, width, height, 1, 0))}>→</button>
        <button onClick={() => onChange(shift(pixels, width, height, 0, -1))}>↑</button>
        <button onClick={() => onChange(shift(pixels, width, height, 0, 1))}>↓</button>
        <button onClick={() => onChange(new Array(width * height).fill(0))}>Leeren</button>
      </div>
      <div className="row">
        <canvas ref={ref} width={width * zoom} height={height * zoom} className="pixels"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onContextMenu={(e) => e.preventDefault()} />
        <div className="swatches vertical">
          {palette.slice(0, 16).map((c, i) => (
            <div key={i} className={`swatch ${i === color ? 'sel1' : ''} ${i === color2 ? 'sel2' : ''}`}
              style={{ background: transparent0 && i === 0 ? 'repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px' : smsToCss(c) }}
              onClick={() => setColor(i)} onContextMenu={(e) => { e.preventDefault(); setColor2(i); }} title={`Farbe ${i}${transparent0 && i === 0 ? ' (transparent)' : ''}`}>
              {i}
            </div>
          ))}
          <small>Links / Rechts</small>
        </div>
      </div>
    </div>
  );
}

function flip(px: number[], w: number, h: number, horiz: boolean) {
  const o: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.push(horiz ? px[y * w + (w - 1 - x)] : px[(h - 1 - y) * w + x]);
  return o;
}
function shift(px: number[], w: number, h: number, dx: number, dy: number) {
  const o: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.push(px[((y - dy + h) % h) * w + ((x - dx + w) % w)]);
  return o;
}
