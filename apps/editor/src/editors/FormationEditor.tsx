import { useEffect, useMemo, useRef, useState } from 'react';
import { formationMembers, framePositions, sampleSpline, type Formation, type Point } from '@sms/core';
import { uid, useStore, useProject } from '../store';
import { spriteCanvases } from '../gfx';

const MARGIN = 64;
const Z = 2;
const W = (256 + MARGIN * 2) * Z, H = (192 + MARGIN * 2) * Z;

const PRESETS: Record<string, Point[]> = {
  'Sinus von rechts': [{ x: 264, y: 40 }, { x: 200, y: 90 }, { x: 140, y: 40 }, { x: 80, y: 90 }, { x: 20, y: 40 }, { x: -40, y: 90 }],
  'Sturzflug von oben': [{ x: 60, y: -24 }, { x: 80, y: 100 }, { x: 160, y: 130 }, { x: 280, y: 60 }],
  'Kreis': [{ x: 264, y: 96 }, { x: 160, y: 96 }, { x: 120, y: 56 }, { x: 160, y: 20 }, { x: 200, y: 56 }, { x: 160, y: 96 }, { x: -40, y: 96 }],
  'Zickzack': [{ x: 264, y: 20 }, { x: 200, y: 160 }, { x: 140, y: 20 }, { x: 80, y: 160 }, { x: -40, y: 20 }],
  'Rein – halten – raus': [{ x: 128, y: -24 }, { x: 128, y: 60 }, { x: 129, y: 62 }, { x: 128, y: 60 }, { x: -40, y: 20 }],
  'Gerade nach links': [{ x: 264, y: 96 }, { x: -40, y: 96 }],
};
const BLOCKS: Record<string, Point[]> = {
  'V-Form': [{ x: 0, y: 0 }, { x: 18, y: -18 }, { x: 18, y: 18 }, { x: 36, y: -36 }, { x: 36, y: 36 }],
  'Reihe': [0, 1, 2, 3, 4].map((i) => ({ x: 0, y: i * 20 - 40 })),
  'Kolonne': [0, 1, 2, 3, 4].map((i) => ({ x: i * 20, y: 0 })),
  'Raute': [{ x: 0, y: 0 }, { x: 18, y: -18 }, { x: 18, y: 18 }, { x: 36, y: 0 }],
};

/** Verzögerung passt in ein Byte: (Anzahl-1) × Abstand ≤ 255 */
const maxSpacing = (count: number) => Math.min(60, Math.floor(255 / Math.max(1, count - 1)));

export function FormationEditor() {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const f = p.formations.find((x) => x.id === sel.formation) ?? p.formations[0];
  const idx = p.formations.findIndex((x) => x.id === f?.id);
  const up = (fn: (d: Formation) => void, co?: string) => edit((d) => { fn(d.formations[idx]); }, co);

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedMul, setSpeedMul] = useState(1);
  const [onion, setOnion] = useState(true);
  const [dragging, setDragging] = useState<number | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);

  const etype = p.enemyTypes.find((e) => e.id === f?.enemyTypeId);
  const sprite = p.sprites.find((s) => s.id === etype?.spriteId);
  const frames = useMemo(() => (sprite ? spriteCanvases(p, sprite.id) : []), [p.sprites, p.palettes.sprite, sprite?.id]);
  const path = useMemo(() => (f && f.points.length >= 2 ? framePositions(f.points, f.speed) : []), [f?.points, f?.speed]);
  const members = useMemo(() => (f ? formationMembers(f) : []), [f]);
  const total = path.length + Math.max(0, ...members.map((m) => m.delay));

  // Max. Hardware-Sprites pro Zeile über die gesamte Animation
  const scan = useMemo(() => {
    if (!sprite || !path.length) return { max: 0, at: 0, heat: new Array(192).fill(0) };
    const cells = sprite.width / 8, h = sprite.height;
    const heat = new Array(192).fill(0);
    let max = 0, at = 0;
    for (let fr = 0; fr < total; fr++) {
      const line = new Array(192).fill(0);
      for (const m of members) {
        const k = fr - m.delay;
        if (k < 0 || k >= path.length) continue;
        const x = path[k].x + m.dx - sprite.width / 2, y = Math.round(path[k].y + m.dy - h / 2);
        if (x < -sprite.width || x > 255) continue;
        for (let yy = Math.max(0, y); yy < Math.min(192, y + h); yy++) line[yy] += cells;
      }
      line.forEach((v, i) => { heat[i] = Math.max(heat[i], v); if (v > max) { max = v; at = fr; } });
    }
    return { max, at, heat };
  }, [sprite, path, members, total]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, acc = t;
    const loop = () => { acc = (acc + speedMul) % Math.max(1, total + 30); setT(Math.floor(acc)); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedMul, total]);

  // Zeichnen
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !f) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0d0d12'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#10204a'; ctx.fillRect(MARGIN * Z, MARGIN * Z, 256 * Z, 192 * Z);
    ctx.strokeStyle = '#4a6ab0'; ctx.strokeRect(MARGIN * Z + 0.5, MARGIN * Z + 0.5, 256 * Z, 192 * Z);
    // Scanline-Heatmap
    scan.heat.forEach((v, y) => {
      if (!v) return;
      ctx.fillStyle = v > 8 ? '#ff3b3b' : v > 6 ? '#ffb020' : '#2fbf71';
      ctx.fillRect(W - 40, (MARGIN + y) * Z, Math.min(v, 12) * 3, Z);
    });
    const P = (q: Point) => [(q.x + MARGIN) * Z, (q.y + MARGIN) * Z] as const;
    // Kurve
    const s = sampleSpline(f.points);
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2; ctx.beginPath();
    s.forEach((q, i) => { const [x, y] = P(q); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke(); ctx.lineWidth = 1;
    // Onion-Skin
    const drawSprite = (x: number, y: number, alpha: number, fr: number) => {
      const c = frames[Math.floor(fr / (sprite?.frameDelay ?? 8)) % Math.max(1, frames.length)];
      if (!c) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(c, (x - c.width / 2 + MARGIN) * Z, (y - c.height / 2 + MARGIN) * Z, c.width * Z, c.height * Z);
      ctx.globalAlpha = 1;
    };
    if (onion) for (let k = 0; k < path.length; k += 12) for (const m of members.slice(0, 1)) drawSprite(path[k].x + m.dx, path[k].y + m.dy, 0.15, 0);
    for (const m of members) {
      const k = t - m.delay;
      if (k < 0 || k >= path.length) continue;
      drawSprite(path[k].x + m.dx, path[k].y + m.dy, 1, t);
    }
    // Punkte
    f.points.forEach((q, i) => {
      const [x, y] = P(q);
      ctx.fillStyle = i === 0 ? '#2fbf71' : i === f.points.length - 1 ? '#ff5050' : '#ffffff';
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.strokeStyle = '#000'; ctx.strokeRect(x - 5.5, y - 5.5, 11, 11);
    });
    ctx.fillStyle = '#8890a8'; ctx.font = '12px sans-serif';
    ctx.fillText('Bildschirm 256×192 – grauer Rand = außerhalb', MARGIN * Z, MARGIN * Z - 8);
    ctx.fillText('Sprites/Zeile', W - 76, MARGIN * Z - 8);
  });

  if (!f) return <div className="panel"><button onClick={() => newFormation()}>+ Formation</button></div>;

  function newFormation() {
    const id = uid('f');
    edit((d) => { d.formations.push({ id, name: 'Neue Formation', enemyTypeId: d.enemyTypes[0]?.id ?? '', points: [...PRESETS['Sinus von rechts']], speed: 1.5, mode: 'chain', count: 5, spacing: 14, offsets: [] }); });
    select({ formation: id });
  }

  const toStage = (e: React.PointerEvent | React.MouseEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return { x: Math.round((e.clientX - r.left) / Z - MARGIN), y: Math.round((e.clientY - r.top) / Z - MARGIN) };
  };
  const hit = (q: Point) => f.points.findIndex((pt) => Math.abs(pt.x - q.x) <= 5 && Math.abs(pt.y - q.y) <= 5);

  return (
    <div className="split">
      <div className="panel narrow">
        <h2>Formationen</h2>
        <ul className="list">
          {p.formations.map((x) => <li key={x.id} className={x.id === f.id ? 'sel' : ''} onClick={() => select({ formation: x.id })}>{x.name}</li>)}
        </ul>
        <div className="toolbar">
          <button onClick={newFormation}>+ Neu</button>
          <button onClick={() => { const id = uid('f'); edit((d) => { d.formations.push({ ...JSON.parse(JSON.stringify(f)), id, name: f.name + ' Kopie' }); }); select({ formation: id }); }}>Duplizieren</button>
          <button onClick={() => {
            if (p.levels.some((l) => l.events.some((e) => e.formationId === f.id)) && !confirm('Formation wird in Leveln benutzt. Löschen (inkl. Ereignisse)?')) return;
            edit((d) => { d.formations.splice(idx, 1); d.levels.forEach((l) => { l.events = l.events.filter((e) => e.formationId !== f.id); }); });
          }}>Löschen</button>
        </div>
        <div className="form">
          <label>Name <input value={f.name} onChange={(e) => up((d) => { d.name = e.target.value; }, 'name')} /></label>
          <label>Gegnertyp <select value={f.enemyTypeId} onChange={(e) => up((d) => { d.enemyTypeId = e.target.value; })}>
            {p.enemyTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          <label>Tempo <input type="range" min={0.25} max={4} step={0.25} value={f.speed} onChange={(e) => up((d) => { d.speed = +e.target.value; }, 'speed')} /> {f.speed} px/F</label>
          <label>Verband
            <select value={f.mode} onChange={(e) => up((d) => { d.mode = e.target.value as Formation['mode']; if (d.mode === 'block' && !d.offsets.length) d.offsets = BLOCKS['V-Form']; })}>
              <option value="chain">Kette (folgen einander)</option>
              <option value="block">Block (starre Formation)</option>
            </select>
          </label>
          <label>Anzahl <input type="range" min={1} max={12} value={f.count} onChange={(e) => up((d) => { d.count = +e.target.value; d.spacing = Math.min(d.spacing, maxSpacing(d.count)); }, 'count')} /> {f.count}</label>
          {f.mode === 'chain'
            ? <label>Abstand <input type="range" min={1} max={maxSpacing(f.count)} value={f.spacing} onChange={(e) => up((d) => { d.spacing = +e.target.value; }, 'spacing')} /> {f.spacing} Frames</label>
            : <label>Form <select value="" onChange={(e) => { const b = BLOCKS[e.target.value]; if (b) up((d) => { d.offsets = b; d.count = b.length; }); }}>
              <option value="">– Vorlage wählen –</option>{Object.keys(BLOCKS).map((k) => <option key={k}>{k}</option>)}</select></label>}
        </div>
        <h3>Pfad</h3>
        <div className="toolbar wrap">
          <select value="" onChange={(e) => { const pr = PRESETS[e.target.value]; if (pr) up((d) => { d.points = pr.map((q) => ({ ...q })); }); }}>
            <option value="">Vorlage …</option>{Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
          </select>
          <button onClick={() => up((d) => { d.points = d.points.map((q) => ({ x: 256 - q.x - 16, y: q.y })); })}>⇋ Spiegeln X</button>
          <button onClick={() => up((d) => { d.points = d.points.map((q) => ({ x: q.x, y: 192 - q.y - 16 })); })}>⇵ Spiegeln Y</button>
          <button onClick={() => up((d) => { d.points.reverse(); })}>↺ Umkehren</button>
        </div>
        <p className="hint">Klick auf leere Fläche: Punkt anhängen · Ziehen: verschieben · Shift+Klick auf Linie: einfügen · Rechtsklick: Punkt löschen. Grün = Start, Rot = Ende.</p>
      </div>
      <div className="panel">
        <canvas ref={ref} width={W} height={H} className="stage"
          onContextMenu={(e) => { e.preventDefault(); const i = hit(toStage(e)); if (i >= 0 && f.points.length > 2) up((d) => { d.points.splice(i, 1); }); }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const q = toStage(e);
            const i = hit(q);
            if (i >= 0) { setDragging(i); (e.target as HTMLElement).setPointerCapture(e.pointerId); return; }
            if (e.shiftKey) {
              // nächstes Segment finden
              let best = 0, bd = Infinity;
              for (let k = 0; k < f.points.length - 1; k++) {
                const a = f.points[k], b = f.points[k + 1];
                const dd = Math.hypot((a.x + b.x) / 2 - q.x, (a.y + b.y) / 2 - q.y);
                if (dd < bd) { bd = dd; best = k; }
              }
              up((d) => { d.points.splice(best + 1, 0, q); });
            } else up((d) => { d.points.push(q); });
          }}
          onPointerMove={(e) => { if (dragging !== null) { const q = toStage(e); up((d) => { d.points[dragging] = q; }, 'drag'); } }}
          onPointerUp={() => setDragging(null)} />
        <div className="timeline">
          <button onClick={() => setPlaying(!playing)}>{playing ? '❚❚' : '▶'}</button>
          <input type="range" min={0} max={total + 30} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} />
          <span>{t} / {total} Frames ({(total / 60).toFixed(1)} s)</span>
          <select value={speedMul} onChange={(e) => setSpeedMul(+e.target.value)}>
            <option value={0.25}>0,25×</option><option value={0.5}>0,5×</option><option value={1}>1×</option>
          </select>
          <label className="check"><input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} /> Onion-Skin</label>
          <span className={`budget ${scan.max > 8 ? 'bad' : scan.max > 6 ? 'warn' : ''}`} title="Maximal 8 Hardware-Sprites pro Bildzeile"
            onClick={() => { setPlaying(false); setT(scan.at); }}>
            max. {scan.max} Sprites/Zeile {scan.max > 8 ? '– Flackern! (Klick springt hin)' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
