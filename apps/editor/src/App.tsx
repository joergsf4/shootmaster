import { useEffect, useMemo, useState } from 'react';
import { buildRom, createDemoProject, type CompileOptions, createTemplateProject, engineBinary, lintProject, MAX_BG_TILES, MAX_SPRITE_TILES, upgradeProject, validateProject, type Orientation, type Project } from '@sms/core';
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
import { Problems, type Problem } from './components/Problems';
import { downloadBlob } from './gfx';
import { isTextEntry } from './keys';

const TABS: [Tab, string][] = [
  ['levels', '🗺 Level'],
  ['formations', '〰 Formationen'],
  ['objects', '🚀 Spieler & Gegner'],
  ['sprites', '👾 Sprites'],
  ['tiles', '▦ Pinsel'],
  ['palette', '🎨 Paletten'],
  ['sound', '🎵 Sound'],
];

const engine = engineBinary();
const TOUR_KEY = 'sms-shmup-tour-done';
/** „einmal gespielt“ (Checkliste) gilt projektunabhängig für diesen Browser */
const PLAYED_KEY = 'sms-shmup-played';
/** Platzhalter-Schiffe der Vorlagen: gilt nicht als „gemalt“ */
const PLACEHOLDER_SHIPS = (['h', 'v'] as const).map((o) => JSON.stringify(createTemplateProject(o).sprites[0].frames[0]));

/** Testlauf: welches Level zuerst, ab welcher Kameraposition */
type PlayOpts = { levelId?: string; startCam?: number };

function tryBuild(p: Project, firstLevel?: string, opts?: CompileOptions) {
  try {
    // Gewähltes Level zuerst, danach die folgenden, dann die davor – wie im Spiel weiter
    const i = firstLevel ? p.levels.findIndex((l) => l.id === firstLevel) : -1;
    const proj = i > 0 ? { ...p, levels: [...p.levels.slice(i), ...p.levels.slice(0, i)] } : p;
    return { ...buildRom(engine, proj, opts), error: undefined };
  } catch (e) {
    return { rom: undefined, data: undefined, error: (e as Error).message };
  }
}

export function App() {
  const { project, tab, setTab, select, undo, redo, past, future, load, edit, saveError, recovered, dismissRecovered } = useStore();
  const [play, setPlay] = useState<{ rom: Uint8Array; title: string; opts: PlayOpts } | null>(null);
  const [invincible, setInvincible] = useState(false);
  const [played, setPlayed] = useState(() => { try { return !!localStorage.getItem(PLAYED_KEY); } catch { return false; } });
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [tour, setTour] = useState(() => { try { return !localStorage.getItem(TOUR_KEY); } catch { return false; } });
  const endTour = () => { setTour(false); try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* nur Komfort */ } };
  const build = useMemo(() => tryBuild(project), [project]);
  const problems = useMemo(() => {
    const d: Problem[] = lintProject(project);
    // Compiler-Fehler ohne eigene Regel (z. B. Bank voll); bei Lint-Fehlern ist er meist dieselbe Ursache
    if (build.error && !d.some((x) => x.severity === 'error')) d.unshift({ severity: 'error', msg: build.error });
    return d;
  }, [project, build]);
  const blocker = problems.find((d) => d.severity === 'error')?.msg;

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (play || isTextEntry(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [play, undo, redo]);

  const startPlay = (opts: PlayOpts = {}, inv = invincible) => {
    if (blocker) { setProblemsOpen(true); return; }
    const b = tryBuild(project, opts.levelId, { startCam: opts.startCam, invincible: inv });
    if (b.error || !b.rom) { alert('ROM kann nicht gebaut werden:\n' + b.error); return; }
    const name = opts.levelId ? project.levels.find((l) => l.id === opts.levelId)?.name : project.name;
    setPlay({ rom: b.rom, title: (name ?? '') + (opts.startCam ? ` · ab ${opts.startCam} px` : ''), opts });
    if (!played) { setPlayed(true); try { localStorage.setItem(PLAYED_KEY, '1'); } catch { /* nur Komfort */ } }
  };

  const replace = (p: Project, what: string) => {
    if (confirm(`Aktuelles Projekt durch ${what} ersetzen? Strg+Z macht es rückgängig; zur Sicherheit vorher mit „💾 Projekt“ als Datei sichern.`)) load(p);
  };

  const ship = project.sprites.find((s) => s.id === project.player.spriteId)?.frames[0];
  const hasSpawn = (l: Project['levels'][number]) => l.events.some((e) => e.type === 'spawn');
  const emptyLevel = project.levels.find((l) => !hasSpawn(l)) ?? project.levels[0];
  const checklist: [boolean, string, () => void][] = [
    [!!ship?.some((v) => v) && !PLACEHOLDER_SHIPS.includes(JSON.stringify(ship)), 'Schiff gemalt', () => { setTab('sprites'); select({ sprite: project.player.spriteId, frame: 0 }); }],
    [project.levels.some(hasSpawn), 'Formation platziert', () => { setTab('levels'); select(emptyLevel ? { level: emptyLevel.id, levelTool: 'events' } : { levelTool: 'events' }); }],
    [played, 'einmal gespielt', () => { if (!play) startPlay(); }],
  ];
  const allDone = checklist.every(([done]) => done);

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
        {/* bei Fehlern klickbar: Klick klappt die Problem-Liste auf */}
        <button className="primary" title={blocker && `Erst beheben: ${blocker}`} onClick={() => { if (!play) startPlay(); }}>▶ Spielen</button>
        <button data-tour="export" title={blocker && `Erst beheben: ${blocker}`} onClick={() => {
          if (blocker || !build.rom) setProblemsOpen(true);
          else downloadBlob(build.rom as Uint8Array<ArrayBuffer>, `${fileName}.sms`);
        }}>⬇ ROM (.sms)</button>
        <button title="Projekt als Datei sichern, zusätzlich zum automatischen Speichern" onClick={() => downloadBlob(JSON.stringify(project), `${fileName}.shmup.json`, 'application/json')}>💾 Projekt</button>
        <label className="button" title="Projektdatei (.json) laden; ersetzt das aktuelle Projekt">📂 Laden<input type="file" accept=".json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const p = upgradeProject(JSON.parse(await f.text()));
            const err = validateProject(p);
            if (err) throw new Error(err);
            replace(p as Project, `„${f.name}“`);
          } catch (err) { alert('Datei konnte nicht geladen werden: ' + (err as Error).message); }
        }} /></label>
        <select className="new-project" value="" title="Neues Projekt anlegen; ersetzt das aktuelle" onChange={(e) => {
          const v = e.target.value;
          if (v === 'demo') replace(createDemoProject(), 'das Demo-Projekt');
          else replace(createTemplateProject(v as Orientation), `ein leeres Spiel (${v === 'h' ? 'horizontal' : 'vertikal'})`);
        }}>
          <option value="" disabled hidden>Neu</option>
          <option value="h">Neues Spiel – horizontal</option>
          <option value="v">Neues Spiel – vertikal</option>
          <option value="demo">Demo-Projekt</option>
        </select>
        <button onClick={() => setTour(true)} title="Geführte Tour durch alle Werkzeuge">? Tutorial</button>
      </header>
      {recovered && (
        <div className="banner">
          ⚠ Der gespeicherte Stand war ungültig ({recovered.error}) und wurde durch das Demo ersetzt.{' '}
          {recovered.key ? 'Er ist im Browser gesichert – lade ihn herunter, wenn du ihn prüfen oder reparieren willst, und schließe dann diesen Hinweis.' : 'Sichern im Browser ging nicht – automatisches Speichern ist aus, bis du diesen Hinweis schließt.'}
          <span className="grow" />
          <button title={recovered.key ? `Im Browser gesichert unter „${recovered.key}“` : undefined} onClick={() => downloadBlob(recovered.raw, 'defekter-stand.json', 'application/json')}>⬇ Alten Stand herunterladen</button>
          <button onClick={dismissRecovered} title="Hinweis schließen">✕</button>
        </div>
      )}
      <nav>
        {TABS.map(([t, label]) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{label}</button>)}
        <span className="sep" />
        {allDone && <button className="todo done" onClick={() => setStepsOpen(!stepsOpen)} title="Checkliste für den Einstieg ein-/ausklappen">✓ Erste Schritte</button>}
        {(!allDone || stepsOpen) && checklist.map(([done, label, go]) => <button key={label} className={`todo ${done ? 'done' : ''}`} onClick={go}>{done ? '☑' : '☐'} {label}</button>)}
        {/* rechts bündig, auch nach einem Zeilenumbruch */}
        <span className="nav-right">
          {st && (
            <span className="stats">
              <Budget label="Kacheln" used={st.bgTiles} max={MAX_BG_TILES} />
              <Budget label="Sprite-Tiles" used={st.spriteTiles} max={MAX_SPRITE_TILES} />
              <span className="budget">ROM {st.romSize / 1024} KB</span>
            </span>
          )}
          <Problems items={problems} open={problemsOpen} setOpen={setProblemsOpen} />
        </span>
      </nav>
      <main>
        {tab === 'palette' && <PaletteEditor />}
        {tab === 'tiles' && <TileEditor />}
        {tab === 'sprites' && <SpriteEditor />}
        {tab === 'objects' && <ObjectsEditor />}
        {tab === 'formations' && <FormationEditor />}
        {tab === 'levels' && <LevelEditor keysOff={!!play || tour} onPlay={(levelId, startCam) => { if (!play) startPlay({ levelId, startCam }); }} />}
        {tab === 'sound' && <SoundEditor />}
      </main>
      {tour && !play && <Tour onClose={endTour} />}
      {play && <PlayModal rom={play.rom} title={play.title} onClose={() => setPlay(null)} onRestart={() => startPlay(play.opts)}
        invincible={invincible} onInvincible={(v) => { setInvincible(v); startPlay(play.opts, v); }} />}
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
