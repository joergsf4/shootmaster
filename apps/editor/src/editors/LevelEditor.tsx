import { useEffect, useMemo, useRef, useState } from 'react';
import { ACROSS, framePositions, formationMembers, type Level, type Orientation } from '@sms/core';
import { uid, useStore, useProject } from '../store';
import { metatileCanvases, spriteCanvases } from '../gfx';
import { MetatileList } from './TileEditor';

type Tool = 'brush' | 'rect' | 'fill' | 'pick' | 'erase' | 'events';

export function LevelEditor({ onPlay }: { onPlay: (levelId: string) => void }) {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const lv = p.levels.find((l) => l.id === sel.level) ?? p.levels[0];
  const li = p.levels.findIndex((l) => l.id === lv?.id);
  const [tool, setTool] = useState<Tool>('brush');
  const [zoom, setZoom] = useState(2);
  const [evSel, setEvSel] = useState<number | null>(null);
  const [evForm, setEvForm] = useState(p.formations[0]?.id ?? '');
  const [showGrid, setShowGrid] = useState(true);
  useEffect(() => { setEvSel(null); }, [sel.level]);

  const addLevel = (o: Orientation) => {
    const id = uid('lvl');
    const len = o === 'h' ? 64 : 48;
    edit((d) => { d.levels.push({ id, name: o === 'h' ? 'Neues Level (horizontal)' : 'Neues Level (vertikal)', orientation: o, length: len, speed: 0.5, map: new Array(len * ACROSS[o]).fill(0), events: [] }); });
    select({ level: id });
  };

  if (!lv) return <div className="panel"><button onClick={() => addLevel('h')}>+ Level</button></div>;

  const setLen = (n: number) => edit((d) => {
    const L = d.levels[li];
    const a = ACROSS[L.orientation];
    n = Math.max(L.orientation === 'h' ? 16 : 12, Math.min(1000, n));
    L.map = Array.from({ length: n * a }, (_, i) => L.map[i] ?? 0);
    L.length = n;
    // Wellen hinter dem neuen Levelende ans Ende holen (die Kamera hält dort an)
    const camMax = Math.max(0, n * 16 - (L.orientation === 'h' ? 256 : 192));
    L.events.forEach((e) => { e.pos = Math.min(e.pos, camMax); });
  });

  return (
    <div className="level-editor">
      <div className="level-side">
        <h2>Level</h2>
        <ul className="list">
          {p.levels.map((l, i) => (
            <li key={l.id} className={l.id === lv.id ? 'sel' : ''} onClick={() => select({ level: l.id })}>
              {i + 1}. {l.name} <small>{l.orientation === 'h' ? '⇢ horiz.' : '⇡ vert.'}</small>
            </li>
          ))}
        </ul>
        <div className="toolbar wrap">
          <button onClick={() => addLevel('h')}>+ Horizontal</button>
          <button onClick={() => addLevel('v')}>+ Vertikal</button>
          <button disabled={li === 0} onClick={() => edit((d) => { const [x] = d.levels.splice(li, 1); d.levels.splice(li - 1, 0, x); })}>▲</button>
          <button disabled={li === p.levels.length - 1} onClick={() => edit((d) => { const [x] = d.levels.splice(li, 1); d.levels.splice(li + 1, 0, x); })}>▼</button>
          <button disabled={p.levels.length <= 1} onClick={() => { if (confirm(`Level „${lv.name}“ löschen?`)) { edit((d) => { d.levels.splice(li, 1); }); select({ level: p.levels[0].id }); } }}>Löschen</button>
        </div>
        <div className="form">
          <label>Name <input value={lv.name} onChange={(e) => edit((d) => { d.levels[li].name = e.target.value; }, 'lvname')} /></label>
          <label>Richtung <b>{lv.orientation === 'h' ? 'horizontal ⇢' : 'vertikal ⇡'}</b></label>
          <label>Länge <input type="number" value={lv.length} onChange={(e) => setLen(+e.target.value)} /> Metatiles ({(lv.length * 16 / (lv.orientation === 'h' ? 256 : 192)).toFixed(1)} Bildschirme)</label>
          <label>Scrolltempo <input type="range" min={0.0625} max={3} step={0.0625} value={lv.speed} onChange={(e) => edit((d) => { d.levels[li].speed = +e.target.value; }, 'lvspeed')} /> {lv.speed} px/F</label>
          <label>Musik <select value={lv.musicId ?? ''} onChange={(e) => edit((d) => { d.levels[li].musicId = e.target.value; })}>
            <option value="">– Stille –</option>
            {p.songs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label>Dauer ≈ <b>{(Math.max(0, lv.length * 16 - (lv.orientation === 'h' ? 256 : 192)) / Math.max(lv.speed, 0.01) / 60).toFixed(0)} s</b></label>
        </div>
        <button className="primary" onClick={() => onPlay(lv.id)}>▶ Dieses Level spielen</button>
        <h3>Pinsel</h3>
        <MetatileList selected={sel.metatile} onSelect={(i) => { select({ metatile: i }); if (tool === 'events' || tool === 'erase' || tool === 'pick') setTool('brush'); }} />
      </div>
      <div className="level-main">
        <div className="toolbar">
          {(['brush', 'rect', 'fill', 'pick', 'erase', 'events'] as Tool[]).map((t) => (
            <button key={t} data-tour={t} className={tool === t ? 'active' : ''} onClick={() => setTool(t)}>
              {{ brush: '✎ Pinsel', rect: '▭ Rechteck', fill: '◧ Füllen', pick: '⌖ Pipette', erase: '⌫ Radierer', events: '◆ Gegner-Ereignisse' }[t]}
            </button>
          ))}
          <span className="sep" />
          <label>Zoom <select value={zoom} onChange={(e) => setZoom(+e.target.value)}>{[1, 2, 3].map((z) => <option key={z} value={z}>{z}×</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Raster</label>
          {tool === 'events' && (
            <>
              <span className="sep" />
              <label>Formation <select value={evForm} onChange={(e) => { setEvForm(e.target.value); if (evSel !== null) edit((d) => { d.levels[li].events[evSel].formationId = e.target.value; }); }}>
                {p.formations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
              {evSel !== null && <button onClick={() => { edit((d) => { d.levels[li].events.splice(evSel, 1); }); setEvSel(null); }}>Ereignis löschen</button>}
            </>
          )}
        </div>
        <p className="hint">
          {tool === 'events'
            ? 'Klick setzt ein Ereignis: Die Formation startet, wenn diese Linie den Bildschirmrand erreicht. Marker ziehen = verschieben, Rechtsklick = löschen.'
            : 'Linke Maustaste malt, rechte Maustaste radiert. Mausrad scrollt, Shift+Mausrad quer.'}
        </p>
        <LevelCanvas level={lv} li={li} tool={tool} zoom={zoom} showGrid={showGrid} evSel={evSel} setEvSel={(i) => { setEvSel(i); if (i !== null) setEvForm(lv.events[i].formationId); }} evForm={evForm} />
      </div>
    </div>
  );
}

interface CanvasProps {
  level: Level; li: number; tool: Tool; zoom: number; showGrid: boolean;
  evSel: number | null; setEvSel: (i: number | null) => void; evForm: string;
}

function LevelCanvas({ level: lv, li, tool, zoom, showGrid, evSel, setEvSel, evForm }: CanvasProps) {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [vp, setVp] = useState({ x: 0, y: 0, w: 800, h: 450 });
  const [hover, setHover] = useState<{ along: number; across: number } | null>(null);
  const [rect, setRect] = useState<{ a0: number; c0: number; a1: number; c1: number } | null>(null);
  const drag = useRef<{ mode: 'paint' | 'event'; value: number; stroke: string; ev?: number } | null>(null);
  const mts = useMemo(() => metatileCanvases(p), [p.metatiles, p.tiles, p.palettes.bg]);
  const H = lv.orientation === 'h';
  const across = ACROSS[lv.orientation];
  const worldW = H ? lv.length * 16 : 256, worldH = H ? 192 : lv.length * 16;

  // Viewport verfolgen
  useEffect(() => {
    const el = scrollRef.current!;
    const upd = () => setVp({ x: el.scrollLeft / zoom, y: el.scrollTop / zoom, w: el.clientWidth / zoom, h: el.clientHeight / zoom });
    upd();
    el.addEventListener('scroll', upd);
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => { el.removeEventListener('scroll', upd); ro.disconnect(); };
  }, [zoom]);
  // Vertikal: Start unten
  useEffect(() => { const el = scrollRef.current!; if (!H) el.scrollTop = el.scrollHeight; else el.scrollLeft = 0; }, [lv.id, zoom]);

  // Welt ↔ Zelle
  const cellAt = (wx: number, wy: number) => H
    ? { along: Math.floor(wx / 16), across: Math.floor(wy / 16) }
    : { along: lv.length - 1 - Math.floor(wy / 16), across: Math.floor(wx / 16) };
  const cellPos = (along: number, ac: number) => H ? { x: along * 16, y: ac * 16 } : { x: ac * 16, y: (lv.length - 1 - along) * 16 };
  const valid = (c: { along: number; across: number }) => c.along >= 0 && c.along < lv.length && c.across >= 0 && c.across < across;
  // Ereignis-Position (Kamera-Pixel) ↔ Weltlinie
  const evLine = (pos: number) => (H ? pos + 256 : worldH - (pos + 192));
  const camMax = Math.max(0, worldW - 256, worldH - 192);
  const posFromWorld = (wx: number, wy: number) => Math.min(camMax, Math.max(0, Math.round(H ? wx - 256 : worldH - wy - 192)));

  const formSprites = useMemo(() => {
    const m = new Map<string, HTMLCanvasElement | undefined>();
    p.formations.forEach((f) => {
      const t = p.enemyTypes.find((e) => e.id === f.enemyTypeId);
      m.set(f.id, t ? spriteCanvases(p, t.spriteId)[0] : undefined);
    });
    return m;
  }, [p.formations, p.enemyTypes, p.sprites, p.palettes.sprite]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0d12'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(zoom, 0, 0, zoom, -vp.x * zoom, -vp.y * zoom);
    // Zellen im sichtbaren Bereich
    const x0 = Math.max(0, Math.floor(vp.x / 16)), x1 = Math.min(Math.ceil((vp.x + vp.w) / 16), worldW / 16);
    const y0 = Math.max(0, Math.floor(vp.y / 16)), y1 = Math.min(Math.ceil((vp.y + vp.h) / 16), worldH / 16);
    for (let cy = y0; cy < y1; cy++) for (let cx = x0; cx < x1; cx++) {
      const c = cellAt(cx * 16, cy * 16);
      const m = lv.map[c.along * across + c.across] ?? 0;
      const img = mts[m] ?? mts[0];
      if (img) ctx.drawImage(img, cx * 16, cy * 16);
    }
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1 / zoom; ctx.beginPath();
      for (let cx = x0; cx <= x1; cx++) { ctx.moveTo(cx * 16, y0 * 16); ctx.lineTo(cx * 16, y1 * 16); }
      for (let cy = y0; cy <= y1; cy++) { ctx.moveTo(x0 * 16, cy * 16); ctx.lineTo(x1 * 16, cy * 16); }
      ctx.stroke();
    }
    // Startbildschirm
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle = '#2fbf71';
    if (H) ctx.strokeRect(0, 0, 256, 192); else ctx.strokeRect(0, worldH - 192, 256, 192);
    ctx.fillStyle = '#2fbf71'; ctx.font = `${10}px sans-serif`;
    ctx.fillText('START', H ? 4 : 4, H ? 12 : worldH - 182);
    // Ereignisse
    lv.events.forEach((ev, i) => {
      const L = evLine(ev.pos);
      const f = p.formations.find((x) => x.id === ev.formationId);
      ctx.strokeStyle = i === evSel ? '#ffcc00' : 'rgba(255,90,90,0.8)';
      ctx.lineWidth = (i === evSel ? 2 : 1) / zoom;
      ctx.beginPath();
      if (H) { ctx.moveTo(L, 0); ctx.lineTo(L, 192); } else { ctx.moveTo(0, L); ctx.lineTo(256, L); }
      ctx.stroke();
      ctx.fillStyle = i === evSel ? '#ffcc00' : '#ff5a5a';
      const mx = H ? L : 248, my = H ? 6 : L;
      ctx.beginPath(); ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 5, my); ctx.lineTo(mx, my + 5); ctx.lineTo(mx - 5, my); ctx.fill();
      ctx.font = '8px sans-serif';
      ctx.fillText(f?.name ?? '?', H ? L + 7 : 4, H ? 10 : L - 3);
      // Pfad-Overlay der gewählten Formation (Bildschirm zum Auslösezeitpunkt)
      if (i === evSel && f && f.points.length >= 2) {
        const camX = H ? ev.pos : 0, camTop = H ? 0 : worldH - ev.pos - 192;
        ctx.strokeStyle = 'rgba(255,204,0,0.6)'; ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.strokeRect(camX, camTop, 256, 192); ctx.setLineDash([]);
        // Kamera bewegt sich weiter → Pfad in Weltkoordinaten
        const path = framePositions(f.points, f.speed);
        const mem = formationMembers(f);
        const speed = lv.speed;
        const spr = formSprites.get(f.id);
        ctx.strokeStyle = 'rgba(255,204,0,0.9)'; ctx.beginPath();
        path.forEach((q, k) => {
          const wx = H ? camX + k * speed + q.x : q.x, wy = H ? q.y : camTop - k * speed + q.y;
          if (k) ctx.lineTo(wx, wy); else ctx.moveTo(wx, wy);
        });
        ctx.stroke();
        // Momentaufnahme 60 Frames nach Auslösung
        const T = 60;
        const camT = H ? camX + T * speed : camTop - T * speed;
        if (spr) mem.forEach((m) => {
          const k = T - m.delay;
          if (k < 0 || k >= path.length) return;
          const q = path[k];
          ctx.globalAlpha = 0.85;
          ctx.drawImage(spr, (H ? camT : 0) + q.x + m.dx - spr.width / 2, (H ? 0 : camT) + q.y + m.dy - spr.height / 2);
          ctx.globalAlpha = 1;
        });
      }
    });
    // Hover / Rechteck
    if (hover && tool !== 'events' && valid(hover)) {
      const q = cellPos(hover.along, hover.across);
      ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1 / zoom; ctx.strokeRect(q.x + 0.5 / zoom, q.y + 0.5 / zoom, 16 - 1 / zoom, 16 - 1 / zoom);
    }
    if (rect) {
      const a = cellPos(rect.a0, rect.c0), b = cellPos(rect.a1, rect.c1);
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      ctx.fillStyle = 'rgba(255,204,0,0.25)'; ctx.fillRect(x, y, Math.abs(a.x - b.x) + 16, Math.abs(a.y - b.y) + 16);
    }
  });

  const world = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { wx: (e.clientX - r.left) / zoom + vp.x, wy: (e.clientY - r.top) / zoom + vp.y };
  };

  const paint = (c: { along: number; across: number }, v: number, stroke: string) => {
    if (!valid(c)) return;
    const i = c.along * across + c.across;
    if (lv.map[i] === v) return;
    edit((d) => { d.levels[li].map[i] = v; }, stroke);
  };

  const floodFill = (c: { along: number; across: number }, v: number) => {
    edit((d) => {
      const map = d.levels[li].map;
      const from = map[c.along * across + c.across];
      if (from === v) return;
      const st = [[c.along, c.across]];
      while (st.length) {
        const [a, b] = st.pop()!;
        if (a < 0 || b < 0 || a >= lv.length || b >= across) continue;
        const i = a * across + b;
        if (map[i] !== from) continue;
        map[i] = v;
        st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
      }
    });
  };

  const eventAt = (wx: number, wy: number) => lv.events.findIndex((ev) => {
    const L = evLine(ev.pos);
    return H ? Math.abs(wx - L) < 5 : Math.abs(wy - L) < 5;
  });

  const down = (e: React.PointerEvent) => {
    const { wx, wy } = world(e);
    const c = cellAt(wx, wy);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const stroke = uid('stroke');
    if (tool === 'events') {
      const i = eventAt(wx, wy);
      if (e.button === 2) { if (i >= 0) { edit((d) => { d.levels[li].events.splice(i, 1); }); setEvSel(null); } return; }
      if (i >= 0) { setEvSel(i); drag.current = { mode: 'event', value: 0, stroke, ev: i }; return; }
      if (!evForm) return;
      const pos = posFromWorld(wx, wy);
      edit((d) => { d.levels[li].events.push({ pos, formationId: evForm }); });
      setEvSel(lv.events.length);
      drag.current = { mode: 'event', value: 0, stroke, ev: lv.events.length };
      return;
    }
    if (!valid(c)) return;
    const v = e.button === 2 || tool === 'erase' ? 0 : sel.metatile;
    if (tool === 'pick') { select({ metatile: lv.map[c.along * across + c.across] }); return; }
    if (tool === 'fill') { floodFill(c, v); return; }
    if (tool === 'rect') { setRect({ a0: c.along, c0: c.across, a1: c.along, c1: c.across }); drag.current = { mode: 'paint', value: v, stroke }; return; }
    drag.current = { mode: 'paint', value: v, stroke };
    paint(c, v, stroke);
  };
  const move = (e: React.PointerEvent) => {
    const { wx, wy } = world(e);
    const c = cellAt(wx, wy);
    setHover(c);
    const d0 = drag.current;
    if (!d0) return;
    if (d0.mode === 'event' && d0.ev !== undefined) {
      const pos = posFromWorld(wx, wy);
      edit((d) => { const ev = d.levels[li].events[d0.ev!]; if (ev) ev.pos = pos; }, d0.stroke);
      return;
    }
    if (tool === 'rect' && rect) { setRect({ ...rect, a1: c.along, c1: c.across }); return; }
    if (tool === 'brush' || tool === 'erase') paint(c, d0.value, d0.stroke);
  };
  const up = () => {
    if (tool === 'rect' && rect && drag.current) {
      const v = drag.current.value;
      edit((d) => {
        const map = d.levels[li].map;
        for (let a = Math.min(rect.a0, rect.a1); a <= Math.max(rect.a0, rect.a1); a++)
          for (let b = Math.min(rect.c0, rect.c1); b <= Math.max(rect.c0, rect.c1); b++)
            if (a >= 0 && b >= 0 && a < lv.length && b < across) map[a * across + b] = v;
      });
    }
    setRect(null);
    drag.current = null;
  };

  return (
    <div ref={scrollRef} className="level-scroll" onWheel={(e) => {
      if (H && !e.shiftKey) { e.currentTarget.scrollLeft += e.deltaY; }
    }}>
      <div style={{ width: worldW * zoom, height: worldH * zoom, position: 'relative' }}>
        <canvas ref={ref} width={Math.ceil(vp.w * zoom)} height={Math.ceil(vp.h * zoom)}
          style={{ position: 'sticky', left: 0, top: 0, display: 'block', cursor: tool === 'events' ? 'crosshair' : 'cell' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => setHover(null)} onContextMenu={(e) => e.preventDefault()} />
      </div>
    </div>
  );
}
