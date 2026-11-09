import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_BG_TILES, type Metatile } from '@sms/core';
import { useStore, useProject } from '../store';
import { PixelEditor } from '../components/PixelEditor';
import { metatileCanvases, paletteRgb, pixelsToImage } from '../gfx';

export function TileEditor() {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const tile = Math.min(sel.tile, p.tiles.length - 1);
  const [quad, setQuad] = useState(0);
  const mtIdx = Math.min(sel.metatile, p.metatiles.length - 1);
  const mt = p.metatiles[mtIdx];
  const usage = useMemo(() => p.metatiles.reduce((n, m) => n + m.tiles.filter((t) => t.tile === tile).length, 0), [p.metatiles, tile]);

  const removeTile = () => {
    if (p.tiles.length <= 1) return;
    if (usage && !confirm(`Tile ${tile} wird in ${usage} Metatile-Feldern benutzt. Trotzdem löschen?`)) return;
    edit((d) => {
      d.tiles.splice(tile, 1);
      d.metatiles.forEach((m) => m.tiles.forEach((t) => { if (t.tile === tile) t.tile = 0; else if (t.tile > tile) t.tile--; }));
    });
    select({ tile: Math.max(0, tile - 1) });
  };

  return (
    <div className="split">
      <div className="panel">
        <h2>BG-Tiles <span className={`budget ${p.tiles.length > MAX_BG_TILES ? 'bad' : ''}`}>{p.tiles.length} / {MAX_BG_TILES}</span></h2>
        <TileSheet selected={tile} onSelect={(t) => select({ tile: t })}
          onAssign={(t) => { select({ tile: t }); if (mt) edit((d) => { d.metatiles[mtIdx].tiles[quad].tile = t; }); }} />
        <p className="hint">Klick wählt ein Tile zum Bearbeiten · Doppelklick setzt es in das markierte Metatile-Viertel.</p>
        <div className="toolbar">
          <button onClick={() => { edit((d) => { d.tiles.push(new Array(64).fill(0)); }); select({ tile: p.tiles.length }); }}>+ Neues Tile</button>
          <button onClick={() => { edit((d) => { d.tiles.splice(tile + 1, 0, [...d.tiles[tile]]); }); select({ tile: tile + 1 }); }}>Duplizieren</button>
          <button onClick={removeTile}>Löschen</button>
          <span className="hint">Tile {tile} · in {usage} Metatile-Feldern</span>
        </div>
        <PixelEditor pixels={p.tiles[tile]} width={8} height={8} palette={p.palettes.bg}
          onChange={(px) => edit((d) => { d.tiles[tile] = px; })} />
        <TilePreview3x3 tile={tile} />
      </div>
      <div className="panel">
        <h2>Metatiles (16×16) <span className="budget">{p.metatiles.length} / 256</span></h2>
        <p className="hint">Metatiles sind die Pinsel im Level-Editor. Jedes besteht aus 4 Tiles, die einzeln gespiegelt werden können.</p>
        <MetatileList selected={mtIdx} onSelect={(i) => select({ metatile: i })} />
        <div className="toolbar">
          <button onClick={() => { edit((d) => { d.metatiles.push({ tiles: [{ tile: 0 }, { tile: 0 }, { tile: 0 }, { tile: 0 }] }); }); select({ metatile: p.metatiles.length }); }}>+ Neu</button>
          <button onClick={() => { edit((d) => { d.metatiles.push(JSON.parse(JSON.stringify(mt)) as Metatile); }); select({ metatile: p.metatiles.length }); }}>Duplizieren</button>
          <button disabled={p.metatiles.length <= 1} onClick={() => {
            edit((d) => {
              d.metatiles.splice(mtIdx, 1);
              d.levels.forEach((l) => { l.map = l.map.map((v) => (v === mtIdx ? 0 : v > mtIdx ? v - 1 : v)); });
            });
            select({ metatile: Math.max(0, mtIdx - 1) });
          }}>Löschen</button>
        </div>
        {mt && (
          <div className="mt-compose">
            <MetatileBig mt={mt} quad={quad} onQuad={(q) => { setQuad(q); select({ tile: mt.tiles[q].tile }); }} />
            <div>
              <h3>Viertel {['oben links', 'oben rechts', 'unten links', 'unten rechts'][quad]}</h3>
              <p>Tile: <b>{mt.tiles[quad].tile}</b>{' '}
                <button disabled={mt.tiles[quad].tile === tile} onClick={() => edit((d) => { d.metatiles[mtIdx].tiles[quad].tile = tile; })}>Gewähltes Tile {tile} einsetzen</button></p>
              {(['hflip', 'vflip', 'priority'] as const).map((k) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={!!mt.tiles[quad][k]} onChange={(e) => edit((d) => { d.metatiles[mtIdx].tiles[quad][k] = e.target.checked; })} />
                  {{ hflip: 'Horizontal spiegeln', vflip: 'Vertikal spiegeln', priority: 'Vor Sprites (Priorität)' }[k]}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TileSheet({ selected, onSelect, onAssign }: { selected: number; onSelect: (t: number) => void; onAssign: (t: number) => void }) {
  const p = useProject();
  const ref = useRef<HTMLCanvasElement>(null);
  const cols = 16, z = 3;
  const rows = Math.max(1, Math.ceil(p.tiles.length / cols));
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#16161c';
    ctx.fillRect(0, 0, cols * 8 * z, rows * 8 * z);
    const pal = paletteRgb(p.palettes.bg);
    const tmp = document.createElement('canvas'); tmp.width = 8; tmp.height = 8;
    const tctx = tmp.getContext('2d')!;
    p.tiles.forEach((t, i) => {
      tctx.putImageData(pixelsToImage(t, 8, 8, pal), 0, 0);
      ctx.drawImage(tmp, (i % cols) * 8 * z, Math.floor(i / cols) * 8 * z, 8 * z, 8 * z);
    });
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2;
    ctx.strokeRect((selected % cols) * 8 * z + 1, Math.floor(selected / cols) * 8 * z + 1, 8 * z - 2, 8 * z - 2);
  });
  const at = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top) / (8 * z)) * cols + Math.floor((e.clientX - r.left) / (8 * z));
    return i < p.tiles.length ? i : -1;
  };
  return <canvas ref={ref} className="sheet" width={cols * 8 * z} height={rows * 8 * z}
    onClick={(e) => { const i = at(e); if (i >= 0) onSelect(i); }}
    onDoubleClick={(e) => { const i = at(e); if (i >= 0) onAssign(i); }} />;
}

function TilePreview3x3({ tile }: { tile: number }) {
  const p = useProject();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const tmp = document.createElement('canvas'); tmp.width = 8; tmp.height = 8;
    tmp.getContext('2d')!.putImageData(pixelsToImage(p.tiles[tile], 8, 8, paletteRgb(p.palettes.bg)), 0, 0);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(tmp, x * 32, y * 32, 32, 32);
  });
  return <div><small>Kachel-Vorschau</small><br /><canvas ref={ref} width={96} height={96} className="pixels" /></div>;
}

export function MetatileList({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const p = useProject();
  const canv = useMemo(() => metatileCanvases(p), [p.metatiles, p.tiles, p.palettes.bg]);
  return (
    <div className="mt-list">
      {canv.map((c, i) => (
        <canvas key={i} width={32} height={32} className={i === selected ? 'sel' : ''} title={`Metatile ${i}`}
          ref={(el) => { if (el) { const x = el.getContext('2d')!; x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, 32, 32); } }}
          onClick={() => onSelect(i)} />
      ))}
    </div>
  );
}

function MetatileBig({ mt, quad, onQuad }: { mt: Metatile; quad: number; onQuad: (q: number) => void }) {
  const p = useProject();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const c = metatileCanvases({ ...p, metatiles: [mt] })[0];
    ctx.drawImage(c, 0, 0, 160, 160);
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.moveTo(80.5, 0); ctx.lineTo(80.5, 160); ctx.moveTo(0, 80.5); ctx.lineTo(160, 80.5); ctx.stroke();
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 3;
    ctx.strokeRect((quad & 1) * 80 + 2, (quad >> 1) * 80 + 2, 76, 76);
  });
  return <canvas ref={ref} width={160} height={160} className="pixels" onClick={(e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onQuad((e.clientX - r.left >= 80 ? 1 : 0) + (e.clientY - r.top >= 80 ? 2 : 0));
  }} />;
}
