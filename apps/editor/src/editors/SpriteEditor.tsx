import { useEffect, useMemo, useRef, useState } from 'react';
import { layoutSprites, MAX_SPRITE_TILES, crop, spriteUsers, type SpriteGfx } from '@sms/core';
import { uid, useStore, useProject } from '../store';
import { PixelEditor } from '../components/PixelEditor';
import { spriteCanvases } from '../gfx';
import { UsedBy } from '../components/Problems';
import { NumberInput } from '../components/NumberInput';

export function SpriteEditor() {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const s = p.sprites.find((x) => x.id === sel.sprite) ?? p.sprites[0];
  const frame = Math.min(sel.frame, (s?.frames.length ?? 1) - 1);
  const used = useMemo(() => layoutSprites(p.sprites).tiles.length, [p.sprites]);
  const idx = p.sprites.findIndex((x) => x.id === s?.id);
  const up = (fn: (d: SpriteGfx) => void, coalesce?: string) => edit((d) => { fn(d.sprites[idx]); }, coalesce);
  /** Löschen gesperrt: Leiste mit den Verwendern, die bei jedem Rendern neu ermittelt werden */
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { setBlocked(false); }, [s?.id]);

  const resize = (w: number, h: number) => up((d) => {
    d.frames = d.frames.map((f) => {
      const o: number[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.push(x < d.width && y < d.height ? f[y * d.width + x] : 0);
      return o;
    });
    d.width = w; d.height = h;
  });

  // HW-Sprites pro Zeile (8×16-Zellen)
  const perLine = s ? (() => {
    const f = s.frames[frame];
    let max = 0;
    for (let cy = 0; cy < s.height; cy += 16) {
      let n = 0;
      for (let cx = 0; cx < s.width; cx += 8) if (crop(f, s.width, cx, cy, 8, 16).some((v) => v)) n++;
      max = Math.max(max, n);
    }
    return max;
  })() : 0;

  return (
    <div className="split">
      <div className="panel narrow">
        <h2>Sprites <span className={`budget ${used > MAX_SPRITE_TILES ? 'bad' : used > MAX_SPRITE_TILES * 0.8 ? 'warn' : ''}`}>{used} / {MAX_SPRITE_TILES} Tiles</span></h2>
        <ul className="list">
          {p.sprites.map((x) => (
            <li key={x.id} className={x.id === s?.id ? 'sel' : ''} onClick={() => select({ sprite: x.id, frame: 0 })}>
              <SpriteThumb id={x.id} /> {x.name} <small>{x.width}×{x.height} · {x.frames.length} F</small>
            </li>
          ))}
        </ul>
        <div className="toolbar">
          <button onClick={() => { const id = uid('spr'); edit((d) => { d.sprites.push({ id, name: 'Neues Sprite', width: 16, height: 16, frames: [new Array(256).fill(0)], frameDelay: 8 }); }); select({ sprite: id, frame: 0 }); }}>+ Neu</button>
          {s && <button onClick={() => { const id = uid('spr'); edit((d) => { d.sprites.push({ ...JSON.parse(JSON.stringify(s)), id, name: s.name + ' Kopie' }); }); select({ sprite: id }); }}>Duplizieren</button>}
          {s && <button onClick={() => {
            const users = spriteUsers(p, s.id);
            if (users.length) { setBlocked(true); return; }
            edit((d) => { d.sprites.splice(idx, 1); });
          }}>Löschen</button>}
        </div>
        {s && blocked && <UsedBy what={`Sprite „${s.name}“`} users={spriteUsers(p, s.id)} onClose={() => setBlocked(false)} />}
        <p className="hint">Sprites werden in 8×16-Hardware-Sprites zerlegt; leere Zellen kosten nichts, gleiche Zellen werden geteilt. Max. 8 Hardware-Sprites pro Bildzeile – sonst Flackern.</p>
      </div>
      {s && (
        <div className="panel">
          <div className="form-row">
            <label>Name <input value={s.name} onChange={(e) => up((d) => { d.name = e.target.value; }, `spname-${s.id}`)} /></label>
            <label>Breite <select value={s.width} onChange={(e) => resize(+e.target.value, s.height)}>{[8, 16, 24, 32, 40, 48].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label>Höhe <select value={s.height} onChange={(e) => resize(s.width, +e.target.value)}>{[16, 32, 48].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label>Frame-Dauer <NumberInput min={1} max={60} value={s.frameDelay} title="Frames je Bild (1 bis 60)" onCommit={(n, c) => up((d) => { d.frameDelay = n; }, c)} /></label>
            <span className={`budget ${perLine > 8 ? 'bad' : perLine > 4 ? 'warn' : ''}`}>{perLine} HW-Sprites/Zeile</span>
          </div>
          <div className="frames">
            {s.frames.map((_, i) => (
              <button key={i} className={i === frame ? 'active' : ''} onClick={() => select({ frame: i })}>Frame {i + 1}</button>
            ))}
            <button onClick={() => { up((d) => { d.frames.splice(frame + 1, 0, [...d.frames[frame]]); }); select({ frame: frame + 1 }); }}>+ Frame</button>
            <button disabled={s.frames.length <= 1} onClick={() => { up((d) => { d.frames.splice(frame, 1); }); select({ frame: Math.max(0, frame - 1) }); }}>− Frame</button>
          </div>
          <div className="row">
            <PixelEditor pixels={s.frames[frame]} width={s.width} height={s.height} palette={p.palettes.sprite} transparent0 cellW={8} cellH={16}
              onChange={(px) => up((d) => { d.frames[frame] = px; })} />
            <AnimPreview sprite={s} />
          </div>
        </div>
      )}
    </div>
  );
}

export function SpriteThumb({ id, scale = 1 }: { id: string; scale?: number }) {
  const p = useProject();
  const s = p.sprites.find((x) => x.id === id);
  const c = useMemo(() => spriteCanvases(p, id)[0], [p.sprites, p.palettes.sprite, id]);
  if (!s || !c) return null;
  return <canvas width={s.width * scale} height={s.height * scale} className="thumb"
    ref={(el) => { if (el) { const x = el.getContext('2d')!; x.imageSmoothingEnabled = false; x.clearRect(0, 0, el.width, el.height); x.drawImage(c, 0, 0, el.width, el.height); } }} />;
}

function AnimPreview({ sprite }: { sprite: SpriteGfx }) {
  const p = useProject();
  const ref = useRef<HTMLCanvasElement>(null);
  const [slow, setSlow] = useState(false);
  const frames = useMemo(() => spriteCanvases(p, sprite.id), [p.sprites, p.palettes.sprite, sprite.id]);
  useEffect(() => {
    let t = 0, raf = 0;
    const loop = () => {
      t += slow ? 0.25 : 1;
      const f = Math.floor(t / sprite.frameDelay) % frames.length;
      const ctx = ref.current?.getContext('2d');
      if (ctx && frames[f]) {
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 128, 128);
        const z = Math.floor(96 / Math.max(sprite.width, sprite.height));
        ctx.drawImage(frames[f], (128 - sprite.width * z) / 2, (128 - sprite.height * z) / 2, sprite.width * z, sprite.height * z);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [frames, sprite.frameDelay, slow, sprite.width, sprite.height]);
  return <div className="anim"><small>Animation (60 fps)</small><canvas ref={ref} width={128} height={128} className="pixels" />
    <label className="check"><input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> Zeitlupe</label></div>;
}
