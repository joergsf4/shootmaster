import { Fragment, useState } from 'react';
import { enemyTypeUsers, noShot, SHOT_PATTERNS, type EnemyShot, type EnemyType, type Hitbox, type ShotPattern } from '@sms/core';
import { WeaponSelect } from './UpgradesEditor';
import { uid, useStore, useProject } from '../store';
import { SpriteThumb } from './SpriteEditor';
import { UsedBy } from '../components/Problems';
import { NumberInput } from '../components/NumberInput';

export function SpriteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = useProject();
  return (
    <span className="sprite-select">
      <SpriteThumb id={value} scale={2} />
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {p.sprites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </span>
  );
}

const HITBOX: [keyof Hitbox, string, string][] = [['x', 'x', 'Abstand vom linken Sprite-Rand (px)'], ['y', 'y', 'Abstand vom oberen Sprite-Rand (px)'], ['w', 'b', 'Breite (px)'], ['h', 'h', 'Höhe (px)']];
export const HITBOX_TITLE = 'Trefferzone im Sprite: x y = Abstand von links/oben, b h = Breite/Höhe (px)';

export function HitboxInput({ value, onChange }: { value: Hitbox; onChange: (h: Hitbox, coalesce?: string) => void }) {
  return (
    <span className="hitbox">
      {HITBOX.map(([k, label, title]) => (
        <label key={k} title={title}>{label}<NumberInput min={0} max={64} value={value[k]} title={title} onCommit={(n, c) => onChange({ ...value, [k]: n }, c)} /></label>
      ))}
    </span>
  );
}

export const SHOT_LABEL: Record<ShotPattern, string> = { none: 'schießt nicht', straight: 'gerade (nach links, im Hochkant-Level nach unten)', aimed: 'gezielt (auf den Spieler)', fan3: 'Fächer (3, gezielt)' };
/** Frames als Sekunden bei 60 Hz, z. B. „≈ 1,5 s“ */
export const secs = (frames: number) => `≈ ${(frames / 60).toFixed(frames < 6 ? 2 : 1).replace('.', ',')} s`;

function ShotInput({ t, i }: { t: EnemyType; i: number }) {
  const { edit } = useStore();
  const s = t.shot;
  const up = (f: (d: EnemyShot) => void, key?: string) => edit((d) => { f(d.enemyTypes[i].shot); }, key);
  return (
    <span className="shot">
      <label>Schussmuster <select value={s.pattern} onChange={(e) => up((d) => { d.pattern = e.target.value as ShotPattern; })}>
        {SHOT_PATTERNS.map((k) => <option key={k} value={k}>{SHOT_LABEL[k]}</option>)}
      </select></label>
      {s.pattern !== 'none' && <>
        <label>Sprite <SpriteSelect value={s.spriteId} onChange={(v) => up((d) => { d.spriteId = v; })} /></label>
        <label>Feuerpause <NumberInput min={8} max={240} value={s.interval} onCommit={(n, c) => up((d) => { d.interval = n; }, c)} /> Frames ({secs(s.interval)})</label>
        <label>Tempo <NumberInput min={0.5} max={4} step={0.25} value={s.speed} onCommit={(n, c) => up((d) => { d.speed = n; }, c)} /> px/Frame</label>
      </>}
    </span>
  );
}

export function ObjectsEditor() {
  const p = useProject();
  const { edit, sel, select, goto } = useStore();
  const pl = p.player;
  /** Gegnertyp, dessen Löschen gesperrt ist; die Verwender werden bei jedem Rendern neu ermittelt */
  const [blocked, setBlocked] = useState<string | null>(null);
  const blockedType = p.enemyTypes.find((x) => x.id === blocked);

  return (
    <div className="split">
      <div className="panel fit">
        <h2>Spieler</h2>
        <div className="form">
          <label>Sprite <SpriteSelect value={pl.spriteId} onChange={(v) => edit((d) => { d.player.spriteId = v; })} /></label>
          <label>Tempo (px/Frame) <NumberInput min={1} max={4} value={pl.speed} onCommit={(n, c) => edit((d) => { d.player.speed = n; }, c)} /></label>
          <label>Leben <NumberInput min={1} max={9} value={pl.lives} onCommit={(n, c) => edit((d) => { d.player.lives = n; }, c)} /></label>
          <label title={HITBOX_TITLE}>Hitbox <HitboxInput value={pl.hitbox} onChange={(h, c) => edit((d) => { d.player.hitbox = h; }, c)} /></label>
        </div>
        <h3>Waffe</h3>
        <div className="form">
          <label>Startwaffe <WeaponSelect value={pl.weaponId} onChange={(v) => edit((d) => { d.player.weaponId = v; })} />
            <button onClick={() => goto({ tab: 'upgrades', id: pl.weaponId })} title="Schüsse, Stufen und Schaden im Tab „Waffen & Power-ups“ bearbeiten">→ Waffen-Tab</button>
          </label>
        </div>
        <h3>Explosion</h3>
        <div className="form">
          <label>Sprite <SpriteSelect value={p.explosionSpriteId} onChange={(v) => edit((d) => { d.explosionSpriteId = v; })} /></label>
        </div>
      </div>
      <div className="panel scroll-x">
        <h2>Gegnertypen</h2>
        <table className="table">
          <thead><tr><th>Name</th><th>Sprite</th><th>HP</th><th>Punkte</th><th title={HITBOX_TITLE}>Hitbox (x y b h)</th></tr></thead>
          <tbody>
            {p.enemyTypes.map((t, i) => (
              <Fragment key={t.id}>
              <tr className={t.id === sel.enemy ? 'sel' : ''}>
                <td><span className="name-cell">
                  <input value={t.name} onChange={(e) => edit((d) => { d.enemyTypes[i].name = e.target.value; }, `enname-${t.id}`)} />
                  <button title="Gegnertyp löschen" onClick={() => {
                    const users = enemyTypeUsers(p, t.id);
                    if (users.length) { setBlocked(t.id); return; }
                    setBlocked(null);
                    edit((d) => { d.enemyTypes.splice(i, 1); });
                  }}>✕</button>
                </span></td>
                <td><SpriteSelect value={t.spriteId} onChange={(v) => edit((d) => { d.enemyTypes[i].spriteId = v; })} /></td>
                <td><NumberInput min={1} max={255} value={t.hp} onCommit={(n, c) => edit((d) => { d.enemyTypes[i].hp = n; }, c)} /></td>
                <td><NumberInput min={0} max={255} value={t.score} onCommit={(n, c) => edit((d) => { d.enemyTypes[i].score = n; }, c)} /></td>
                <td><HitboxInput value={t.hitbox} onChange={(h, c) => edit((d) => { d.enemyTypes[i].hitbox = h; }, c)} /></td>
              </tr>
              <tr className={`sub ${t.id === sel.enemy ? 'sel' : ''}`}><td /><td colSpan={4}><ShotInput t={t} i={i} /></td></tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="hint">Gegner schießen nur im Bild, der erste Schuss fällt nach einer vollen Feuerpause. Höchstens 16 Gegnerschüsse gleichzeitig, weitere entfallen.</p>
        {blockedType && <UsedBy what={`Gegnertyp „${blockedType.name}“`} users={enemyTypeUsers(p, blockedType.id)} onClose={() => setBlocked(null)} />}
        <button onClick={() => {
          const id = uid('e');
          // Sprite und Schuss-Sprite vom letzten Gegnertyp: Spielerschiff/-schuss passen fast nie
          edit((d) => {
            const last = d.enemyTypes[d.enemyTypes.length - 1];
            d.enemyTypes.push({ id, name: 'Neuer Gegner', spriteId: last?.spriteId ?? d.sprites[0].id, hp: 1, hitbox: { x: 2, y: 2, w: 12, h: 12 }, score: 10, shot: noShot(last?.shot.spriteId ?? d.weapons.find((w) => w.id === d.player.weaponId)?.spriteId ?? d.sprites[0].id) });
          });
          select({ enemy: id });
        }}>+ Gegnertyp</button>
      </div>
    </div>
  );
}
