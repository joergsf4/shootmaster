import { useEffect, useMemo, useRef } from 'react';
import { layoutBgTiles, MAX_BG_TILES } from '@sms/core';
import { useStore, useProject } from '../store';
import { PixelEditor } from '../components/PixelEditor';
import { metatileCanvases } from '../gfx';

/** Pinsel-Editor: jeder Pinsel ist ein eigenes 16×16-Bild. */
export function TileEditor() {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const i = Math.min(sel.metatile, p.metatiles.length - 1);
  const m = p.metatiles[i];
  const tileCount = useMemo(() => layoutBgTiles(p.metatiles).tiles.length, [p.metatiles]);
  const uses = useMemo(() => p.levels.reduce((n, l) => n + l.map.filter((v) => v === i).length, 0), [p.levels, i]);

  return (
    <div className="split">
      <div className="panel narrow">
        <h2>Pinsel</h2>
        <p className="hint">Jeder Pinsel ist ein 16×16-Bild, mit dem du im Level malst. Er wird einzeln bearbeitet – andere Pinsel ändern sich nie mit.</p>
        <MetatileList selected={i} onSelect={(n) => select({ metatile: n })} />
        <div className="toolbar">
          <button onClick={() => { edit((d) => { d.metatiles.push({ pixels: new Array(256).fill(0) }); }); select({ metatile: p.metatiles.length }); }}>+ Neu</button>
          <button onClick={() => { edit((d) => { d.metatiles.push({ ...d.metatiles[i], pixels: [...d.metatiles[i].pixels] }); }); select({ metatile: p.metatiles.length }); }}>Duplizieren</button>
          <button disabled={p.metatiles.length <= 1} onClick={() => {
            if (uses && !confirm(`Dieser Pinsel ist ${uses}× in Leveln gemalt. Dort wird er durch Pinsel 0 ersetzt. Löschen?`)) return;
            edit((d) => {
              d.metatiles.splice(i, 1);
              d.levels.forEach((l) => { l.map = l.map.map((v) => (v === i ? 0 : v > i ? v - 1 : v)); });
            });
            select({ metatile: Math.max(0, i - 1) });
          }}>Löschen</button>
        </div>
        <p className="hint">
          Speicher: <span className={`budget ${tileCount > MAX_BG_TILES ? 'bad' : tileCount > MAX_BG_TILES * 0.8 ? 'warn' : ''}`}>{tileCount} / {MAX_BG_TILES} Kacheln</span><br />
          Gleiche oder gespiegelte 8×8-Teile verschiedener Pinsel werden automatisch nur einmal gespeichert. Pinsel 0 füllt leere Levelflächen.
        </p>
      </div>
      {m && (
        <div className="panel">
          <div className="form-row">
            <b>Pinsel {i}</b>
            <span className="hint">{uses ? `${uses}× in Leveln gemalt` : 'noch in keinem Level benutzt'}</span>
            <label className="check">
              <input type="checkbox" checked={!!m.priority} onChange={(e) => edit((d) => { d.metatiles[i].priority = e.target.checked || undefined; })} />
              Vor Sprites (Priorität)
            </label>
            <label className="check">
              <input type="checkbox" checked={!!m.solid} onChange={(e) => edit((d) => { d.metatiles[i].solid = e.target.checked || undefined; })} />
              Tödlich bei Berührung
            </label>
            <span className="hint">Spieler verliert ein Leben, Schüsse verschwinden. Im Level rot umrandet.</span>
          </div>
          <div className="row">
            <PixelEditor pixels={m.pixels} width={16} height={16} palette={p.palettes.bg}
              onChange={(px) => edit((d) => { d.metatiles[i].pixels = px; })} />
            <TiledPreview index={i} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 3×3 gekachelt: zeigt, ob der Pinsel nahtlos aneinanderpasst */
function TiledPreview({ index }: { index: number }) {
  const p = useProject();
  const ref = useRef<HTMLCanvasElement>(null);
  const canv = useMemo(() => metatileCanvases(p), [p.metatiles, p.palettes.bg]);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(canv[index], x * 48, y * 48, 48, 48);
  });
  return <div><small>Gekachelt</small><br /><canvas ref={ref} width={144} height={144} className="pixels" /></div>;
}

export function MetatileList({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const p = useProject();
  const canv = useMemo(() => metatileCanvases(p), [p.metatiles, p.palettes.bg]);
  return (
    <div className="mt-list">
      {canv.map((c, i) => (
        <canvas key={i} width={32} height={32} className={`${i === selected ? 'sel' : ''} ${p.metatiles[i].solid ? 'solid' : ''}`} title={`Pinsel ${i}${p.metatiles[i].solid ? ' – tödlich' : ''}`}
          ref={(el) => { if (el) { const x = el.getContext('2d')!; x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, 32, 32); } }}
          onClick={() => onSelect(i)} />
      ))}
    </div>
  );
}
