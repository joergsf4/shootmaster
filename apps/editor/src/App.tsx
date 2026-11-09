import { useEffect, useMemo, useState } from 'react';
import { buildRom, createDemoProject, engineBinary, MAX_BG_TILES, MAX_SPRITE_TILES, upgradeProject, validateProject, type Project } from '@sms/core';
import { useStore, type Tab } from './store';
import { PaletteEditor } from './editors/PaletteEditor';
import { TileEditor } from './editors/TileEditor';
import { SpriteEditor } from './editors/SpriteEditor';
import { ObjectsEditor } from './editors/ObjectsEditor';
import { FormationEditor } from './editors/FormationEditor';
import { LevelEditor } from './editors/LevelEditor';
import { SoundEditor } from './editors/SoundEditor';
import { PlayModal } from './components/PlayModal';
import { Tour } from './components/Tour';
import { downloadBlob } from './gfx';

const TABS: [Tab, string][] = [
  ['levels', '🗺 Level'],
  ['formations', '〰 Formationen'],
  ['objects', '🚀 Spieler & Gegner'],
  ['sprites', '👾 Sprites'],
  ['tiles', '▦ Tiles'],
  ['palette', '🎨 Paletten'],
  ['sound', '🎵 Sound'],
];

const engine = engineBinary();
const TOUR_KEY = 'sms-shmup-tour-done';

function tryBuild(p: Project, firstLevel?: string) {
  try {
    const proj = firstLevel ? { ...p, levels: [...p.levels.filter((l) => l.id === firstLevel), ...p.levels.filter((l) => l.id !== firstLevel)] } : p;
    return { ...buildRom(engine, proj), error: undefined };
  } catch (e) {
    return { rom: undefined, data: undefined, error: (e as Error).message };
  }
}

export function App() {
  const { project, tab, setTab, undo, redo, past, future, load, edit, saveError } = useStore();
  const [play, setPlay] = useState<{ rom: Uint8Array; title: string } | null>(null);
  const [tour, setTour] = useState(() => { try { return !localStorage.getItem(TOUR_KEY); } catch { return false; } });
  const endTour = () => { setTour(false); try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* nur Komfort */ } };
  const build = useMemo(() => tryBuild(project), [project]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (play || (e.target as HTMLElement).tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [play, undo, redo]);

  const startPlay = (levelId?: string) => {
    const b = tryBuild(project, levelId);
    if (b.error || !b.rom) { alert('ROM kann nicht gebaut werden:\n' + b.error); return; }
    const name = levelId ? project.levels.find((l) => l.id === levelId)?.name : project.name;
    setPlay({ rom: b.rom, title: name ?? '' });
  };

  const fileName = project.name.replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '_') || 'shmup';
  const st = build.data?.stats;

  return (
    <div className="app">
      <header>
        <div className="brand">SMS<span>Shmup</span>Maker</div>
        <input className="project-name" value={project.name} onChange={(e) => edit((d) => { d.name = e.target.value; }, 'pname')} />
        <button disabled={!past.length} onClick={undo} title="Rückgängig (Strg+Z)">↶</button>
        <button disabled={!future.length} onClick={redo} title="Wiederholen (Strg+Y)">↷</button>
        <span className="grow" />
        {saveError && <span className="budget bad" title="Der Browser lässt kein Speichern zu (blockiert oder voll).">⚠ Nicht gespeichert – bitte Projekt exportieren</span>}
        <button className="primary" onClick={() => startPlay()}>▶ Spielen</button>
        <button data-tour="export" disabled={!build.rom} onClick={() => build.rom && downloadBlob(build.rom as Uint8Array<ArrayBuffer>, `${fileName}.sms`)}>⬇ ROM (.sms)</button>
        <button onClick={() => downloadBlob(JSON.stringify(project), `${fileName}.shmup.json`, 'application/json')}>💾 Projekt</button>
        <label className="button">📂 Laden<input type="file" accept=".json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const p = upgradeProject(JSON.parse(await f.text()));
            const err = validateProject(p);
            if (err) throw new Error(err);
            load(p as Project);
          } catch (err) { alert('Datei konnte nicht geladen werden: ' + (err as Error).message); }
          e.target.value = '';
        }} /></label>
        <button onClick={() => { if (confirm('Aktuelles Projekt durch das Demo-Projekt ersetzen?')) load(createDemoProject()); }}>Demo</button>
        <button onClick={() => setTour(true)}>? Tutorial</button>
      </header>
      <nav>
        {TABS.map(([t, label]) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{label}</button>)}
        <span className="grow" />
        {st && (
          <span className="stats">
            <Budget label="BG-Tiles" used={st.bgTiles} max={MAX_BG_TILES} />
            <Budget label="Sprite-Tiles" used={st.spriteTiles} max={MAX_SPRITE_TILES} />
            <span className="budget">ROM {st.romSize / 1024} KB</span>
          </span>
        )}
        {build.error && <span className="budget bad" title={build.error}>⚠ {build.error}</span>}
      </nav>
      <main>
        {tab === 'palette' && <PaletteEditor />}
        {tab === 'tiles' && <TileEditor />}
        {tab === 'sprites' && <SpriteEditor />}
        {tab === 'objects' && <ObjectsEditor />}
        {tab === 'formations' && <FormationEditor />}
        {tab === 'levels' && <LevelEditor onPlay={startPlay} />}
        {tab === 'sound' && <SoundEditor />}
      </main>
      {tour && !play && <Tour onClose={endTour} />}
      {play && <PlayModal rom={play.rom} title={play.title} onClose={() => setPlay(null)} />}
    </div>
  );
}

function Budget({ label, used, max }: { label: string; used: number; max: number }) {
  const r = used / max;
  return (
    <span className={`budget ${r > 1 ? 'bad' : r > 0.8 ? 'warn' : ''}`} title={`${label}: ${used} von ${max}`}>
      {label} <span className="bar"><span style={{ width: `${Math.min(100, r * 100)}%` }} /></span> {used}/{max}
    </span>
  );
}
