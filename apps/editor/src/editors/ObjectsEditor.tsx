import { Fragment, useState } from 'react';
import { enemyTypeUsers, noShot, SHOT_PATTERNS, type EnemyShot, type EnemyType, type Hitbox, type ShotPattern, type Use } from '@sms/core';
import { uid, useStore, useProject } from '../store';
import { SpriteThumb } from './SpriteEditor';
import { UsedBy } from '../components/Problems';

function SpriteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

function HitboxInput({ value, onChange }: { value: Hitbox; onChange: (h: Hitbox) => void }) {
  return (
    <span className="hitbox">
      {(['x', 'y', 'w', 'h'] as const).map((k) => (
        <label key={k}>{k}<input type="number" min={0} max={64} value={value[k]} onChange={(e) => onChange({ ...value, [k]: +e.target.value })} /></label>
      ))}
    </span>
  );
}

const SHOT_LABEL: Record<ShotPattern, string> = { none: 'schießt nicht', straight: 'gerade', aimed: 'gezielt', fan3: 'Fächer (3, gezielt)' };

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
        <label>Feuerpause <input type="range" min={8} max={240} value={s.interval} onChange={(e) => up((d) => { d.interval = +e.target.value; }, `enshotrate-${t.id}`)} /> {s.interval} Frames</label>
        <label>Tempo <input type="range" min={0.5} max={4} step={0.25} value={s.speed} onChange={(e) => up((d) => { d.speed = +e.target.value; }, `enshotspeed-${t.id}`)} /> {s.speed} px/F</label>
      </>}
    </span>
  );
}

const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Number(v) || 0));

export function ObjectsEditor() {
  const p = useProject();
  const { edit, sel } = useStore();
  const pl = p.player;
  const [blocked, setBlocked] = useState<{ name: string; users: Use[] } | null>(null);

  return (
    <div className="split">
      <div className="panel">
        <h2>Spieler</h2>
        <div className="form">
          <label>Sprite <SpriteSelect value={pl.spriteId} onChange={(v) => edit((d) => { d.player.spriteId = v; })} /></label>
          <label>Tempo (px/Frame) <input type="number" min={1} max={4} value={pl.speed} onChange={(e) => edit((d) => { d.player.speed = num(e.target.value, 1, 4); })} /></label>
          <label>Leben <input type="number" min={1} max={9} value={pl.lives} onChange={(e) => edit((d) => { d.player.lives = num(e.target.value, 1, 9); })} /></label>
          <label>Hitbox <HitboxInput value={pl.hitbox} onChange={(h) => edit((d) => { d.player.hitbox = h; }, 'plhitbox')} /></label>
        </div>
        <h3>Schuss</h3>
        <div className="form">
          <label>Sprite <SpriteSelect value={pl.shotSpriteId} onChange={(v) => edit((d) => { d.player.shotSpriteId = v; })} /></label>
          <label>Tempo (px/Frame) <input type="number" min={1} max={12} value={pl.shotSpeed} onChange={(e) => edit((d) => { d.player.shotSpeed = num(e.target.value, 1, 12); })} /></label>
          <label>Feuerpause (Frames) <input type="number" min={1} max={60} value={pl.fireRate} onChange={(e) => edit((d) => { d.player.fireRate = num(e.target.value, 1, 60); })} /></label>
          <label>Versatz x/y
            <span className="hitbox">
              <input type="number" value={pl.shotOffset.x} onChange={(e) => edit((d) => { d.player.shotOffset.x = num(e.target.value, -64, 64); })} />
              <input type="number" value={pl.shotOffset.y} onChange={(e) => edit((d) => { d.player.shotOffset.y = num(e.target.value, -64, 64); })} />
            </span>
          </label>
          <label>Hitbox <HitboxInput value={pl.shotHitbox} onChange={(h) => edit((d) => { d.player.shotHitbox = h; }, 'shothitbox')} /></label>
        </div>
        <h3>Explosion</h3>
        <div className="form">
          <label>Sprite <SpriteSelect value={p.explosionSpriteId} onChange={(v) => edit((d) => { d.explosionSpriteId = v; })} /></label>
        </div>
      </div>
      <div className="panel scroll-x">
        <h2>Gegnertypen</h2>
        <table className="table">
          <thead><tr><th>Name</th><th>Sprite</th><th>HP</th><th>Punkte</th><th>Hitbox (x y b h)</th><th /></tr></thead>
          <tbody>
            {p.enemyTypes.map((t, i) => (
              <Fragment key={t.id}>
              <tr className={t.id === sel.enemy ? 'sel' : ''}>
                <td><input value={t.name} onChange={(e) => edit((d) => { d.enemyTypes[i].name = e.target.value; }, `enname-${t.id}`)} /></td>
                <td><SpriteSelect value={t.spriteId} onChange={(v) => edit((d) => { d.enemyTypes[i].spriteId = v; })} /></td>
                <td><input type="number" min={1} max={255} value={t.hp} onChange={(e) => edit((d) => { d.enemyTypes[i].hp = num(e.target.value, 1, 255); })} /></td>
                <td><input type="number" min={0} max={255} value={t.score} onChange={(e) => edit((d) => { d.enemyTypes[i].score = num(e.target.value, 0, 255); })} /></td>
                <td><HitboxInput value={t.hitbox} onChange={(h) => edit((d) => { d.enemyTypes[i].hitbox = h; }, `enhitbox-${t.id}`)} /></td>
                <td><button onClick={() => {
                  const users = enemyTypeUsers(p, t.id);
                  if (users.length) { setBlocked({ name: `Gegnertyp „${t.name}“`, users }); return; }
                  setBlocked(null);
                  edit((d) => { d.enemyTypes.splice(i, 1); });
                }}>✕</button></td>
              </tr>
              <tr className={`sub ${t.id === sel.enemy ? 'sel' : ''}`}><td /><td colSpan={5}><ShotInput t={t} i={i} /></td></tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        {blocked && <UsedBy what={blocked.name} users={blocked.users} onClose={() => setBlocked(null)} />}
        <button onClick={() => edit((d) => { d.enemyTypes.push({ id: uid('e'), name: 'Neuer Gegner', spriteId: d.sprites[0].id, hp: 1, hitbox: { x: 2, y: 2, w: 12, h: 12 }, score: 10, shot: noShot(d.player.shotSpriteId) }); })}>+ Gegnertyp</button>
      </div>
    </div>
  );
}
