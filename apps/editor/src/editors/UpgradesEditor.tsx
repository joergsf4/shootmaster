import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emitterPlacement, MAX_EMITTERS, MAX_SHOTS, MAX_WEAPON_LEVELS, opaqueBox, shotVelocity, upgradeBudget, weaponPreset, weaponUsers, WEAPON_PRESETS,
  type Emitter, type Orientation, type Project, type StageBudget, type UpgradeStyle, type Weapon, type WeaponLevel, type WeaponPreset,
} from '@sms/core';
import { uid, useStore, useProject } from '../store';
import { HITBOX_TITLE, HitboxInput, secs, SpriteSelect } from './ObjectsEditor';
import { NumberInput } from '../components/NumberInput';
import { UsedBy } from '../components/Problems';
import { spriteCanvases } from '../gfx';

/** Teuerstes Level einer Waffenstufe */
type Worst = StageBudget & { name: string };
const LEVEL_TEXT = { green: 'passt ins Bild', yellow: 'kann verlangsamen', red: 'zu teuer, gesperrt' } as const;
const takte = (n: number) => n.toLocaleString('de-DE');
export const budgetText = (b: Worst | null) =>
  b ? `${LEVEL_TEXT[b.level]}: bis ${takte(b.cost)} Takte je Bild (Level „${b.name}“ bei ${b.pos} px, bis zu ${b.shots} Schüsse gleichzeitig)` : 'kein Level';

/** Budget je Waffenstufe über alle Level, je Projektstand zwischengespeichert */
function useBudget(p: Project) {
  const cache = useMemo(() => new Map<string, Worst | null>(), [p]);
  return (weapon: Weapon, level: number): Worst | null => {
    const key = JSON.stringify([weapon, level]);
    if (cache.has(key)) return cache.get(key)!;
    let worst: Worst | null = null;
    for (const lv of p.levels) {
      const b = upgradeBudget(p, lv, { weapon, level });
      if (!worst || b.cost > worst.cost) worst = { ...b, name: lv.name };
    }
    cache.set(key, worst);
    return worst;
  };
}

/** Auswahl einer Waffe; zu teure Waffen (Stufe 1 rot) sind gesperrt, der Grund steht darunter (Tooltips an gesperrten Optionen zeigen Browser nicht) */
export function WeaponSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = useProject();
  const budget = useBudget(p);
  const red = p.weapons.map((w) => [w, budget(w, 0)] as const).filter(([w, b]) => b?.level === 'red' && w.id !== value);
  return (
    <span className="weapon-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!p.weapons.some((w) => w.id === value) && <option value={value} disabled>– fehlt –</option>}
        {p.weapons.map((w) => {
          const off = red.some(([x]) => x.id === w.id);
          return <option key={w.id} value={w.id} disabled={off}>{w.name}{off ? ' (zu teuer)' : ''}</option>;
        })}
      </select>
      {red.map(([w, b]) => <span key={w.id} className="hint">„{w.name}“ gesperrt: {budgetText(b)}</span>)}
    </span>
  );
}

const STYLES: [UpgradeStyle, string, string][] = [
  ['off', 'Aus', 'Nur die Startwaffe, keine Kapseln.'],
  ['direct', 'Direkt', 'Kapseln wirken sofort beim Einsammeln.'],
  ['gauge', 'Leiste', 'Kapseln schieben einen Cursor wie bei Gradius, Taste 2 aktiviert.'],
];

export function UpgradesEditor() {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const w = p.weapons.find((x) => x.id === sel.weapon) ?? p.weapons[0];
  const wi = p.weapons.findIndex((x) => x.id === w?.id);
  const stage = sel.stage;
  const setStage = (n: number) => select({ stage: n });
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { setBlocked(false); }, [w?.id]);
  const budget = useBudget(p);
  const up = (fn: (d: Weapon) => void, co?: string) => edit((d) => { fn(d.weapons[wi]); }, co);

  const addPreset = (kind: WeaponPreset) => {
    const id = uid('w');
    edit((d) => { d.weapons.push(weaponPreset(kind, id, w?.spriteId ?? d.sprites[0].id)); });
    select({ weapon: id, stage: 0 });
  };

  return (
    <div className="split">
      <div className="panel narrow">
        <h2>Stil</h2>
        <div className="form">
          {STYLES.map(([k, label, text]) => (
            <label key={k} className="check" title={k === 'off' ? text : `${text} Kommt bald (mit den Kapseln).`}>
              <input type="radio" name="style" checked={p.upgrades.style === k} disabled={k !== 'off'} onChange={() => edit((d) => { d.upgrades.style = k; })} />
              <b>{label}</b> <span className="hint">{text}{k !== 'off' && ' (kommt bald)'}</span>
            </label>
          ))}
        </div>
        <h2>Waffen</h2>
        <ul className="list">
          {p.weapons.map((x) => (
            <li key={x.id} className={x.id === w?.id ? 'sel' : ''} onClick={() => select({ weapon: x.id, stage: 0 })}>
              {x.name}
              <small>{x.levels.map((_, i) => <Dot key={i} b={budget(x, i)} />)} {x.id === p.player.weaponId && 'Start'}</small>
            </li>
          ))}
        </ul>
        <div className="toolbar">
          <select value="" title="Neue Waffe mit fertigen Stufen" onChange={(e) => { if (e.target.value) addPreset(e.target.value as WeaponPreset); }}>
            <option value="">+ aus Vorlage …</option>
            {WEAPON_PRESETS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          {w && <button onClick={() => { const id = uid('w'); edit((d) => { d.weapons.push({ ...JSON.parse(JSON.stringify(w)), id, name: w.name + ' Kopie' }); }); select({ weapon: id, stage: 0 }); }}>Duplizieren</button>}
          {w && <button onClick={() => {
            if (weaponUsers(p, w.id).length) { setBlocked(true); return; }
            edit((d) => { d.weapons.splice(wi, 1); });
          }}>Löschen</button>}
        </div>
        {blocked && w && <UsedBy what={`Waffe „${w.name}“`} users={weaponUsers(p, w.id)} onClose={() => setBlocked(false)} />}
        <h2>Regeln</h2>
        <div className="form">
          <label>Startwaffe <WeaponSelect value={p.player.weaponId} onChange={(v) => edit((d) => { d.player.weaponId = v; })} /></label>
        </div>
        <p className="hint">Das Spiel beginnt mit Stufe 1 der Startwaffe. Kapseln, Stufenwechsel und Verlust bei Treffer kommen mit dem Stil „Direkt“.</p>
      </div>
      {w && <WeaponPanel key={w.id} p={p} w={w} stage={Math.min(stage, w.levels.length - 1)} setStage={setStage} up={up} budget={budget} />}
    </div>
  );
}

function Dot({ b }: { b: Worst | null }) {
  return <span className={`dot ${b?.level ?? ''}`} title={budgetText(b)} />;
}

function WeaponPanel({ p, w, stage, setStage, up, budget }: {
  p: Project; w: Weapon; stage: number; setStage: (n: number) => void;
  up: (fn: (d: Weapon) => void, co?: string) => void; budget: (w: Weapon, level: number) => Worst | null;
}) {
  const st = w.levels[stage];
  const upSt = (fn: (d: WeaponLevel) => void, co?: string) => up((d) => { fn(d.levels[stage]); }, co);
  const sprite = p.sprites.find((s) => s.id === w.spriteId);
  // Was ein weiterer Austritt kosten würde: gesperrt, wenn ein Level rot würde
  const more = budget({ ...w, levels: w.levels.map((l, i) => (i === stage ? { ...l, emitters: [...l.emitters, { ahead: 8, side: 0, dir: 0 }] } : l)) }, stage);
  const addBlock = st.emitters.length >= MAX_EMITTERS ? `Höchstens ${MAX_EMITTERS} Austritte je Stufe` : more?.level === 'red' ? `Gesperrt, mit einem Austritt mehr ${budgetText(more)}` : '';
  const DIR_TITLE = 'Richtung zur Flugrichtung in 22,5°-Schritten: 0 geradeaus, 4 rechts, 8 nach hinten, 12 links';
  return (
    <div className="panel">
      <h2>Waffe</h2>
      <div className="form-row">
        <label>Name <input value={w.name} onChange={(e) => up((d) => { d.name = e.target.value; }, `wname-${w.id}`)} /></label>
        <label>Sprite <SpriteSelect value={w.spriteId} onChange={(v) => up((d) => { d.spriteId = v; })} /></label>
        <label>Tempo <NumberInput min={0.5} max={8} step={0.25} value={w.speed} onCommit={(n, c) => up((d) => { d.speed = n; }, c)} /> px/Frame</label>
        <label className="check" title="Der Schuss fliegt nach einem Treffer weiter und trifft jeden Gegner einmal"><input type="checkbox" checked={w.pierce} onChange={(e) => up((d) => { d.pierce = e.target.checked; })} /> Durchschlag</label>
      </div>
      <div className="form-row">
        <label className="check" title="Aus: Trefferzone = sichtbare Pixel des ersten Frames">
          <input type="checkbox" checked={!!w.hitbox} onChange={(e) => up((d) => { d.hitbox = e.target.checked && sprite ? opaqueBox(sprite) : undefined; })} /> eigene Hitbox
        </label>
        {w.hitbox
          ? <span title={HITBOX_TITLE}><HitboxInput value={w.hitbox} onChange={(h, c) => up((d) => { d.hitbox = h; }, c)} /></span>
          : <span className="hint">sichtbare Pixel des Sprites</span>}
      </div>
      <div className="toolbar stages">
        {w.levels.map((_, i) => (
          <button key={i} className={i === stage ? 'active' : ''} onClick={() => setStage(i)} title={budgetText(budget(w, i))}>
            Stufe {i + 1} <Dot b={budget(w, i)} />
          </button>
        ))}
        <button disabled={w.levels.length >= MAX_WEAPON_LEVELS} title={w.levels.length >= MAX_WEAPON_LEVELS ? `Höchstens ${MAX_WEAPON_LEVELS} Stufen` : 'Neue Stufe als Kopie der gewählten'}
          onClick={() => { up((d) => { d.levels.push(JSON.parse(JSON.stringify(d.levels[stage]))); }); setStage(w.levels.length); }}>+ Stufe</button>
        <button disabled={w.levels.length <= 1} title="Gewählte Stufe löschen" onClick={() => { up((d) => { d.levels.splice(stage, 1); }); setStage(Math.max(0, stage - 1)); }}>✕ Stufe</button>
      </div>
      <p className={`hint budget-line ${budget(w, stage)?.level ?? ''}`}>Rechenzeit: {budgetText(budget(w, stage))}</p>
      <div className="row">
        <div className="emit-col">
          <div className="form-row">
            <label>Feuerpause <NumberInput min={1} max={60} value={st.fireRate} onCommit={(n, c) => upSt((d) => { d.fireRate = n; }, c)} /> Frames ({secs(st.fireRate)})</label>
            <label>Schaden <NumberInput min={1} max={255} value={st.damage} onCommit={(n, c) => upSt((d) => { d.damage = n; }, c)} /></label>
          </div>
          <table className="table emitters">
            <thead><tr><th title={DIR_TITLE}>Richtung</th><th title="Abstand der Schussmitte von der Schiffsmitte nach vorn (px)">vorn</th><th title="Abstand nach rechts zur Flugrichtung (px), negativ = links">seitlich</th><th /></tr></thead>
            <tbody>
              {st.emitters.map((e, i) => {
                const set = (fn: (d: Emitter) => void, co?: string) => upSt((d) => { fn(d.emitters[i]); }, co);
                return (
                  <tr key={i}>
                    <td title={DIR_TITLE}><span className="dir-pick">
                      <button onClick={() => set((d) => { d.dir = (d.dir + 15) & 15; })} title="gegen den Uhrzeigersinn">⟲</button>
                      <span className="arrow" style={{ transform: `rotate(${e.dir * 22.5}deg)` }}>➜</span>
                      <button onClick={() => set((d) => { d.dir = (d.dir + 1) & 15; })} title="im Uhrzeigersinn">⟳</button>
                    </span></td>
                    <td><NumberInput min={-32} max={32} value={e.ahead} onCommit={(n, c) => set((d) => { d.ahead = n; }, c)} /></td>
                    <td><NumberInput min={-32} max={32} value={e.side} onCommit={(n, c) => set((d) => { d.side = n; }, c)} /></td>
                    <td><button disabled={st.emitters.length <= 1} title="Austritt löschen" onClick={() => upSt((d) => { d.emitters.splice(i, 1); })}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button disabled={!!addBlock} title={addBlock || 'Weiterer Schuss je Salve'} onClick={() => upSt((d) => { d.emitters.push({ ahead: 8, side: 0, dir: 0 }); })}>+ Austritt</button>
          <p className="hint">Je Austritt ein Schuss pro Salve, höchstens {MAX_SHOTS} Spielerschüsse gleichzeitig. Schräge Schüsse behalten ihr Sprite (wird nicht gedreht).</p>
        </div>
        <div className="previews">
          <WeaponPreview p={p} w={w} st={st} o="h" />
          <WeaponPreview p={p} w={w} st={st} o="v" />
        </div>
      </div>
    </div>
  );
}

/** Vorschau: Schiff und Flugbahnen einer Salve (alle 4 Frames ein Abbild), H mit Flug nach rechts, V nach oben */
function WeaponPreview({ p, w, st, o }: { p: Project; w: Weapon; st: WeaponLevel; o: Orientation }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const Z = 2, W = 112, H = 112;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#10204a';
    ctx.fillRect(0, 0, W * Z, H * Z);
    const ship = p.sprites.find((s) => s.id === p.player.spriteId) ?? { id: '', width: 16, height: 16 };
    const shot = p.sprites.find((s) => s.id === w.spriteId) ?? { id: '', width: 8, height: 16 };
    const [sx, sy] = o === 'h' ? [32, (H - ship.height) >> 1] : [(W - ship.width) >> 1, 72];
    const shotC = spriteCanvases(p, shot.id)[0];
    for (const e of st.emitters) {
      const q = emitterPlacement(e, o, ship, shot);
      const [vx, vy] = shotVelocity(w.speed, q.dir).map((v) => v / 256);
      for (let t = 36; t >= 0; t -= 4) {
        const x = sx + q.dx + vx * t, y = sy + q.dy + vy * t;
        ctx.globalAlpha = t ? 0.25 + 0.5 * (1 - t / 36) : 1;
        if (shotC) ctx.drawImage(shotC, Math.round(x) * Z, Math.round(y) * Z, shot.width * Z, shot.height * Z);
      }
    }
    ctx.globalAlpha = 1;
    const shipC = spriteCanvases(p, ship.id)[0];
    if (shipC) ctx.drawImage(shipC, sx * Z, sy * Z, ship.width * Z, ship.height * Z);
    ctx.fillStyle = '#8890a8';
    ctx.font = '12px sans-serif';
    ctx.fillText(o === 'h' ? 'horizontal →' : 'vertikal ↑', 6, 16);
  });
  return <canvas ref={ref} width={W * Z} height={H * Z} className="stage preview" title="Vorschau einer Salve: Abbild alle 4 Frames" />;
}
