import { useEffect, useMemo, useRef, useState } from 'react';
import { ACROSS, framePositions, formationMembers, LEVEL_EVENT_TYPES, levelCamMax, levelDuration, shrinkLoss, sortedEvents, stackNeighbor, type Level, type LevelEvent, type LevelEventType, type Orientation, type Project } from '@sms/core';
import { uid, useStore, useProject, type LevelTool as Tool } from '../store';
import { metatileCanvases, spriteCanvases } from '../gfx';
import { isTextEntry } from '../keys';
import { MetatileList } from './TileEditor';
import { NumberInput } from '../components/NumberInput';

/** Vorlage für neue Ereignisse = Werte des gewählten Ereignisses */
type EvTpl = Required<Omit<LevelEvent, 'pos'>>;

const EV_LABEL: Record<LevelEventType, string> = { spawn: 'Formation', speed: 'Tempo', music: 'Musik', waitClear: 'Warten, bis alle weg sind', checkpoint: 'Checkpoint' };
const EV_COLOR: Record<LevelEventType, string> = { spawn: '#ff5a5a', speed: '#4fc3f7', music: '#c792ea', waitClear: '#ffa04f', checkpoint: '#2fbf71' };
/** Hinweiszeile, solange ein Ereignis dieses Typs gewählt ist */
const EV_HINT: Record<LevelEventType, string> = {
  spawn: 'Die Formation startet, wenn diese Linie den Bildschirmrand erreicht. Der gestrichelte Rahmen zeigt den Bildschirm in diesem Moment.',
  speed: 'Ab hier scrollt die Kamera in diesem Tempo. „Stopp“ hält sie an; weiter geht es nur mit einem späteren Tempo-Ereignis an derselben Stelle (z. B. nach „Warten“).',
  music: 'Ab hier läuft dieser Song, bei „Stille“ keine Musik.',
  waitClear: 'Kamera hält hier, bis alle Gegner abgeschossen oder weggeflogen sind.',
  checkpoint: 'Nach Game Over startet das Level hier.',
};
/** Zahl deutsch mit höchstens 4 Nachkommastellen */
const de = (n: number) => String(+n.toFixed(4)).replace('.', ',');
const makeEvent = (pos: number, t: EvTpl): LevelEvent =>
  t.type === 'spawn' ? { pos, type: t.type, formationId: t.formationId }
    : t.type === 'speed' ? { pos, type: t.type, speed: t.speed }
      : t.type === 'music' ? { pos, type: t.type, musicId: t.musicId }
        : { pos, type: t.type };
const evLabel = (p: Project, ev: LevelEvent) =>
  ev.type === 'spawn' ? p.formations.find((x) => x.id === ev.formationId)?.name ?? '?'
    : ev.type === 'speed' ? (ev.speed ? `Tempo ${de(ev.speed)}` : 'Stopp')
      : ev.type === 'music' ? `Musik: ${ev.musicId ? p.songs.find((s) => s.id === ev.musicId)?.name ?? '?' : 'Stille'}`
        : ev.type === 'waitClear' ? 'Warten' : 'Checkpoint';

/** keysOff: Spiel oder Tour offen, dann gehören Esc/Entf/P ihnen */
export function LevelEditor({ onPlay, keysOff }: { onPlay: (levelId: string, startCam?: number) => void; keysOff: boolean }) {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const lv = p.levels.find((l) => l.id === sel.level) ?? p.levels[0];
  const li = p.levels.findIndex((l) => l.id === lv?.id);
  const tool = sel.levelTool;
  const setTool = (t: Tool) => select({ levelTool: t });
  const [zoom, setZoom] = useState(2);
  const [evSel, setEvSel] = useState<number | null>(null);
  const [tpl, setTplState] = useState<EvTpl>({ type: 'spawn', formationId: p.formations[0]?.id ?? '', speed: 0, musicId: '' });
  /** gewähltes Ereignis; undefined, wenn keins gewählt ist */
  const ev = evSel === null ? undefined : lv?.events[evSel];
  const setTpl = (patch: Partial<EvTpl>, key?: string) => {
    const t = { ...tpl, ...patch };
    setTplState(t);
    if (ev && evSel !== null) edit((d) => { const L = d.levels[li]; L.events[evSel] = makeEvent(L.events[evSel].pos, t); }, key);
  };
  // Auswahl folgt den Daten (Undo, Löschen, Levelwechsel): verschwundenes Ereignis abwählen, sonst Leiste aus dem Ereignis füllen
  useEffect(() => {
    if (evSel === null) return;
    if (!ev) { setEvSel(null); return; }
    const { pos: _, ...f } = ev;
    setTplState((t) => ({ ...t, ...f }));
  }, [ev, evSel]);
  useEffect(() => { setEvSel(null); }, [sel.level]);
  // Sprung aus dem Problem-Panel: Ereignis an der Position wählen (LevelCanvas scrollt vorher hin), dann Sprungziel verbrauchen
  // shortcut: wählt das erste Ereignis an der Position; Index mitgeben, wenn gestapelte Fehler-Ereignisse verwirren
  const focus = useStore((s) => s.focus);
  useEffect(() => {
    if (!focus || !lv) return;
    const i = lv.events.findIndex((e) => Math.round(e.pos) === focus.pos);
    setEvSel(i >= 0 ? i : null);
    useStore.setState({ focus: null });
  }, [focus]);
  /** getippte, noch nicht übernommene Länge (Vorwarnung beim Kürzen) */
  const [lenDraft, setLenDraft] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  // Kameraposition am linken (h) bzw. unteren (v) Rand der Ansicht, setzt LevelCanvas
  const camAt = useRef(0);
  const keys = useRef({ play: () => {}, deselect: () => {}, del: () => {} });
  keys.current = {
    play: () => { if (lv && !keysOff) onPlay(lv.id, camAt.current); },
    deselect: () => { if (!keysOff) setEvSel(null); },
    del: () => { if (!keysOff && ev && evSel !== null) { edit((d) => { d.levels[li].events.splice(evSel, 1); }); setEvSel(null); } },
  };
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target)) return;
      if (e.key === 'Escape') keys.current.deselect();
      else if (e.key === 'Delete') keys.current.del();
      // P auch in Auswahlfeld/Regler: „Formation umstellen, sofort testen“; preventDefault verhindert die Tippauswahl
      else if (e.code === 'KeyP' && !e.repeat) { e.preventDefault(); keys.current.play(); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, []);

  const addLevel = (o: Orientation) => {
    const id = uid('lvl');
    const len = o === 'h' ? 64 : 48;
    edit((d) => { d.levels.push({ id, name: o === 'h' ? 'Neues Level (horizontal)' : 'Neues Level (vertikal)', orientation: o, length: len, speed: 0.5, map: new Array(len * ACROSS[o]).fill(0), events: [] }); });
    select({ level: id });
  };

  // Neue Formations-Ereignisse: gelöschte/fehlende Vorlage durch die erste Formation ersetzen
  const newTpl = tpl.type === 'spawn' && !p.formations.some((f) => f.id === tpl.formationId) ? { ...tpl, formationId: p.formations[0]?.id ?? '' } : tpl;

  if (!lv) return <div className="panel"><button onClick={() => addLevel('h')}>+ Level</button></div>;

  const minLen = lv.orientation === 'h' ? 16 : 12;
  const setLen = (n: number) => edit((d) => {
    const L = d.levels[li];
    const a = ACROSS[L.orientation];
    n = Math.max(minLen, Math.min(1000, n));
    L.map = Array.from({ length: n * a }, (_, i) => L.map[i] ?? 0);
    L.length = n;
    // Wellen hinter dem neuen Levelende ans Ende holen (die Kamera hält dort an)
    const camMax = Math.max(0, n * 16 - (L.orientation === 'h' ? 256 : 192));
    L.events.forEach((e) => { e.pos = Math.min(e.pos, camMax); });
  });
  const loss = lenDraft !== null && lenDraft < lv.length ? shrinkLoss(lv, lenDraft) : null;
  const lossText = loss && [
    loss.cut && `Kürzt die Karte um ${loss.cut} ${lv.orientation === 'h' ? 'Spalten' : 'Zeilen'}`,
    loss.events && `${loss.events === 1 ? '1 Ereignis rückt' : `${loss.events} Ereignisse rücken`} ans Levelende`,
  ].filter(Boolean).join(', ');
  const dur = levelDuration(lv);
  const speedText = (v: number) => v ? `${de(v)} px/Frame (${v === lv.speed ? '= Leveltempo' : `${de(v / lv.speed)}× Leveltempo`})` : 'Stopp';
  const swap = (j: number) => {
    if (evSel === null || j < 0) return;
    edit((d) => { const E = d.levels[li].events; [E[evSel], E[j]] = [E[j], E[evSel]]; });
    setEvSel(j);
  };

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
          <label>Länge <NumberInput value={lv.length} min={minLen} max={1000} live={false} title={`${minLen} bis 1000 Felder, je 16 px`} onCommit={setLen} onDraft={setLenDraft} /> Felder (16 px)</label>
          {lossText && <span className="hint warn-text">{lossText} (Strg+Z macht es rückgängig)</span>}
          <label>Scrolltempo <input type="range" min={0.0625} max={3} step={0.0625} value={lv.speed} onChange={(e) => edit((d) => { d.levels[li].speed = +e.target.value; }, 'lvspeed')} /> {lv.speed} px/Frame</label>
          <label>Musik <select value={lv.musicId ?? ''} onChange={(e) => edit((d) => { d.levels[li].musicId = e.target.value; })}>
            <option value="">– Stille –</option>
            {p.songs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
          <label title="Scrollzeit bis zum Levelende mit allen Tempo-Ereignissen; „Warten“ kommt mit der Kampfzeit dazu">Dauer <span><b>{dur.stopAt !== null
            ? `endet nie (Stopp bei ${dur.stopAt} px)`
            : `≈ ${Math.round(dur.frames / 60)} s${lv.events.some((e) => e.type === 'waitClear') ? ' + Kampfzeit' : ''}`}</b>
            {' '}· {de(+(lv.length * 16 / (lv.orientation === 'h' ? 256 : 192)).toFixed(1))} Bildschirme</span></label>
        </div>
        <button className="primary" onClick={() => onPlay(lv.id)} title="Startet am Levelanfang; danach folgen die übrigen Level">▶ Dieses Level spielen</button>
        <h3>Pinsel</h3>
        <MetatileList selected={sel.metatile} onSelect={(i) => { select({ metatile: i }); if (tool === 'events' || tool === 'erase' || tool === 'pick') setTool('brush'); }} />
      </div>
      <div className="level-main">
        <div className="toolbar">
          {(['brush', 'rect', 'fill', 'pick', 'erase', 'events'] as Tool[]).map((t) => (
            <button key={t} data-tour={t} className={tool === t ? 'active' : ''} onClick={() => setTool(t)}>
              {{ brush: '✎ Pinsel', rect: '▭ Rechteck', fill: '◧ Füllen', pick: '⌖ Pipette', erase: '⌫ Radierer', events: '◆ Ereignisse' }[t]}
            </button>
          ))}
          <span className="sep" />
          <label>Zoom <select value={zoom} onChange={(e) => setZoom(+e.target.value)}>{[1, 2, 3].map((z) => <option key={z} value={z}>{z}×</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Raster</label>
          <button onClick={() => keys.current.play()} title="Spielt ab dem linken (horizontal) bzw. unteren (vertikal) Rand der Ansicht (Taste P); danach folgen die übrigen Level">▶ Ab hier (P)</button>
          {tool === 'events' && (
            <>
              <span className="sep" />
              <b>{ev ? `Gewählt: ${evLabel(p, ev)}` : 'Neu:'}</b>
              {/* Tempo startet beim Leveltempo, nicht bei Stopp (das hielte die Kamera für immer an) */}
              <label>Typ <select value={tpl.type} onChange={(e) => { const type = e.target.value as LevelEventType; setTpl(type === 'speed' && tpl.type !== 'speed' ? { type, speed: lv.speed } : { type }); }}>
                {LEVEL_EVENT_TYPES.map((t) => <option key={t} value={t} disabled={t === 'spawn' && !p.formations.length}>{EV_LABEL[t]}</option>)}</select></label>
              {tpl.type === 'spawn' && <label>Formation <select value={ev ? tpl.formationId : newTpl.formationId} onChange={(e) => setTpl({ formationId: e.target.value })}>
                {p.formations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
              {tpl.type === 'speed' && <label>Tempo <input type="range" min={0} max={3} step={0.0625} value={tpl.speed}
                onChange={(e) => setTpl({ speed: +e.target.value }, `evspeed-${lv.id}-${evSel}`)} /> {speedText(tpl.speed)}</label>}
              {tpl.type === 'speed' && <>
                <button onClick={() => setTpl({ speed: 0 })} title="Kamera anhalten">Stopp</button>
                <button onClick={() => setTpl({ speed: lv.speed })} title={`Zurück zum Scrolltempo des Levels (${de(lv.speed)} px/Frame)`}>Leveltempo</button>
              </>}
              {tpl.type === 'music' && <label>Song <select value={tpl.musicId} onChange={(e) => setTpl({ musicId: e.target.value })}>
                <option value="">– Stille –</option>
                {p.songs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
              {ev && evSel !== null && <>
                <label title={`Kamera-Position, an der das Ereignis auslöst (0 bis ${levelCamMax(lv)} px)`}>Position <NumberInput value={Math.round(ev.pos)} min={0} max={levelCamMax(lv)}
                  onCommit={(n, c) => edit((d) => { d.levels[li].events[evSel].pos = n; }, c)} /> px</label>
                <button disabled={stackNeighbor(lv, evSel, -1) < 0} onClick={() => swap(stackNeighbor(lv, evSel, -1))} title="Mit dem Ereignis davor an derselben Stelle tauschen: löst früher aus">früher</button>
                <button disabled={stackNeighbor(lv, evSel, 1) < 0} onClick={() => swap(stackNeighbor(lv, evSel, 1))} title="Mit dem Ereignis danach an derselben Stelle tauschen: löst später aus">später</button>
                <button title="Neues Ereignis an derselben Position, läuft direkt danach ab" onClick={() => {
                  edit((d) => { const L = d.levels[li]; L.events.splice(evSel + 1, 0, makeEvent(ev.pos, tpl)); });
                  setEvSel(evSel + 1);
                }}>+ Gleiche Stelle</button>
                <button onClick={() => keys.current.del()} title="Gewähltes Ereignis löschen (Entf)">Ereignis löschen</button>
                <button onClick={() => onPlay(lv.id, ev.pos)} title="Danach folgen die übrigen Level">▶ Ab diesem Ereignis</button>
                <button onClick={() => setEvSel(null)} title="Nichts mehr gewählt: Die Leiste stellt dann das nächste neue Ereignis ein (Esc)">✕ Auswahl aufheben</button>
              </>}
            </>
          )}
        </div>
        <p className="hint">
          {tool !== 'events' ? 'Linke Maustaste malt, rechte Maustaste radiert. Mausrad scrollt, Shift+Mausrad quer.'
            : ev ? EV_HINT[ev.type]
              : 'Klick setzt ein Ereignis: Es löst aus, wenn diese Linie den Bildschirmrand erreicht. Mehrere an einer Stelle laufen in Marker-Reihenfolge ab. Marker ziehen = verschieben (rastet an vorhandenen Linien ein), Rechtsklick oder Entf = löschen, Esc = Auswahl aufheben.'}
          {` P spielt ab dem ${lv.orientation === 'h' ? 'linken' : 'unteren'} Rand der Ansicht; blasse Ereignisse sind dann schon vorbei.`}
        </p>
        <LevelCanvas focus={focus} camAt={camAt} level={lv} li={li} tool={tool} zoom={zoom} showGrid={showGrid} evSel={evSel} setEvSel={setEvSel} tpl={newTpl} />
      </div>
    </div>
  );
}

interface CanvasProps {
  /** Sprungziel aus dem Problem-Panel: dorthin scrollen */
  focus: { pos: number } | null;
  camAt: React.MutableRefObject<number>;
  level: Level; li: number; tool: Tool; zoom: number; showGrid: boolean;
  evSel: number | null; setEvSel: (i: number | null) => void; tpl: EvTpl;
}

function LevelCanvas({ focus, camAt, level: lv, li, tool, zoom, showGrid, evSel, setEvSel, tpl }: CanvasProps) {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [vp, setVp] = useState({ x: 0, y: 0, w: 800, h: 450 });
  const [hover, setHover] = useState<{ along: number; across: number } | null>(null);
  const [rect, setRect] = useState<{ a0: number; c0: number; a1: number; c1: number } | null>(null);
  const drag = useRef<{ mode: 'paint' | 'event'; value: number; stroke: string; ev?: number } | null>(null);
  const mts = useMemo(() => metatileCanvases(p), [p.metatiles, p.palettes.bg]);
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
  // Sprungziel mittig zeigen (läuft nach dem Zurücksetzen oben)
  useEffect(() => {
    if (!focus) return;
    const el = scrollRef.current!, L = evLine(Math.min(focus.pos, camMax)) * zoom;
    if (H) el.scrollLeft = L - el.clientWidth / 2; else el.scrollTop = L - el.clientHeight / 2;
  }, [focus]);

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
  camAt.current = Math.min(camMax, Math.max(0, Math.round(H ? vp.x : worldH - vp.y - vp.h)));
  // Marker an derselben Position stapeln (H: nach unten, V: nach links), Reihenfolge = Ablauf
  const marker = (i: number) => {
    const ev = lv.events[i], L = evLine(ev.pos);
    const k = lv.events.slice(0, i).filter((e) => e.pos === ev.pos).length;
    return H ? { x: L, y: 6 + k * 12, k } : { x: 248 - k * 12, y: L, k };
  };

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
      if (p.metatiles[m]?.solid) { ctx.strokeStyle = 'rgba(255,60,60,0.7)'; ctx.lineWidth = 1 / zoom; ctx.strokeRect(cx * 16 + 0.5 / zoom, cy * 16 + 0.5 / zoom, 16 - 1 / zoom, 16 - 1 / zoom); }
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
      const f = ev.type === 'spawn' ? p.formations.find((x) => x.id === ev.formationId) : undefined;
      const col = EV_COLOR[ev.type];
      // vor dem „Ab hier“-Startpunkt: im Test schon vorbei → blass
      ctx.globalAlpha = ev.pos < camAt.current ? 0.35 : 1;
      ctx.strokeStyle = i === evSel ? col : col + 'cc';
      ctx.lineWidth = (i === evSel ? 2 : 1) / zoom;
      ctx.beginPath();
      if (H) { ctx.moveTo(L, 0); ctx.lineTo(L, 192); } else { ctx.moveTo(0, L); ctx.lineTo(256, L); }
      ctx.stroke();
      ctx.fillStyle = col;
      const { x: mx, y: my, k } = marker(i);
      ctx.beginPath(); ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 5, my); ctx.lineTo(mx, my + 5); ctx.lineTo(mx - 5, my); ctx.closePath(); ctx.fill();
      // Auswahl: weiße Umrandung, die Typfarbe bleibt sichtbar
      if (i === evSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / zoom; ctx.stroke(); }
      // Beschriftung auf dunklem Grund
      const text = evLabel(p, ev), tx = H ? L + 7 : 4, ty = H ? my + 4 : L - 3 - k * 9;
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#000000b0'; ctx.fillRect(tx - 1, ty - 7, ctx.measureText(text).width + 2, 9);
      ctx.fillStyle = i === evSel ? '#fff' : col;
      ctx.fillText(text, tx, ty);
      ctx.globalAlpha = 1;
      // Gewähltes Ereignis: Bildschirm zum Auslösezeitpunkt, bei Formationen dazu der Pfad
      const camX = H ? ev.pos : 0, camTop = H ? 0 : worldH - ev.pos - 192;
      if (i === evSel) {
        ctx.strokeStyle = 'rgba(255,204,0,0.6)'; ctx.lineWidth = 1 / zoom; ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.strokeRect(camX, camTop, 256, 192); ctx.setLineDash([]);
      }
      if (i === evSel && f && f.points.length >= 2) {
        // Kamera bewegt sich weiter → Pfad in Weltkoordinaten
        const path = framePositions(f.points, f.speed);
        const mem = formationMembers(f);
        // Tempo an dieser Stelle (Tempo-Ereignisse bis hier, auch direkt danach an derselben Position)
        // shortcut: „Warten“ hält die Kamera in Wahrheit an; ausbauen, wenn Boss-Vorschauen stören
        let speed = lv.speed;
        for (const e of sortedEvents(lv)) { if (e.pos > ev.pos) break; if (e.type === 'speed') speed = e.speed ?? 0; }
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

  // Ereignis unter dem Mauszeiger: Linie getroffen, bei gestapelten Markern der nächste
  const eventAt = (wx: number, wy: number) => {
    let best = -1, bd = Infinity;
    lv.events.forEach((ev, i) => {
      const L = evLine(ev.pos), m = marker(i);
      if (Math.abs(H ? wx - L : wy - L) >= 5) return;
      const d = Math.abs(H ? wy - m.y : wx - m.x);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };

  const down = (e: React.PointerEvent) => {
    const { wx, wy } = world(e);
    const c = cellAt(wx, wy);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const stroke = uid('stroke');
    if (tool === 'events') {
      const i = eventAt(wx, wy);
      if (e.button === 2) { if (i >= 0) { edit((d) => { d.levels[li].events.splice(i, 1); }); setEvSel(null); } return; }
      if (i >= 0) { setEvSel(i); drag.current = { mode: 'event', value: 0, stroke, ev: i }; return; }
      if (tpl.type === 'spawn' && !tpl.formationId) return;
      const pos = posFromWorld(wx, wy);
      edit((d) => { d.levels[li].events.push(makeEvent(pos, tpl)); });
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
      // an eine vorhandene Linie einrasten (±4 px), damit Stapeln auch nachträglich gelingt
      let pos = posFromWorld(wx, wy);
      const snap = lv.events.find((e, j) => j !== d0.ev && Math.abs(e.pos - pos) <= 4);
      if (snap) pos = snap.pos;
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
