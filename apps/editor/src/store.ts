import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { createDemoProject, upgradeProject, validateProject, type DiagRef, type EditorTab, type Project } from '@sms/core';

const KEY = 'sms-shmup-project-v1';
const MAX_HISTORY = 200;

export type Tab = EditorTab;
export type LevelTool = 'brush' | 'rect' | 'fill' | 'pick' | 'erase' | 'events';

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  tab: Tab;
  /** Auswahl je Editor; levelTool liegt hier, damit Sprünge (Checkliste, Problem-Panel) das Werkzeug mit umschalten können */
  sel: { metatile: number; sprite: string; frame: number; formation: string; level: string; enemy: string; weapon: string; stage: number; song: string; sfx: string; levelTool: LevelTool };
  /** Änderung mit Undo-Schritt */
  edit: (fn: (d: Draft<Project>) => void, coalesce?: string) => void;
  undo: () => void;
  redo: () => void;
  setTab: (t: Tab) => void;
  select: (s: Partial<State['sel']>) => void;
  /** Sprung zu einem Element (Problem-Panel, Verwender-Links) */
  goto: (r: DiagRef) => void;
  /** Sprungziel im Level (Kamera-Pixel): der Level-Editor scrollt hin, wählt das Ereignis dort und löscht es dann; neues Objekt je Sprung */
  focus: { pos: number } | null;
  load: (p: Project) => void;
  /** Autosave fehlgeschlagen → Nutzer muss exportieren */
  saveError: boolean;
  /** Gespeicherter Stand war ungültig und wurde durch das Demo ersetzt (Hinweis-Banner) */
  recovered: Recovered | null;
  /** Banner schließen */
  dismissRecovered: () => void;
}

/** raw = alter Stand; key = Sicherungsschlüssel oder null, wenn die Sicherung fehlschlug (dann kein Autosave bis zum Schließen) */
export interface Recovered { raw: string; key: string | null; error: string }

function initial(): { project: Project; recovered: Recovered | null } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      const p = upgradeProject(JSON.parse(raw));
      const err = validateProject(p);
      if (!err) return { project: p as Project, recovered: null };
      throw new Error(err);
    }
  } catch (e) {
    if (raw) {
      // Ungültigen Stand nicht vom nächsten Autosave überschreiben lassen
      let key: string | null = `${KEY}-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      try { localStorage.setItem(key, raw); } catch { key = null; }
      return { project: createDemoProject(), recovered: { raw, key, error: (e as Error).message } };
    }
  }
  return { project: createDemoProject(), recovered: null };
}

let lastCoalesce: string | undefined;
let lastCoalesceTime = 0;

const init = initial();
const p0 = init.project;
export const useStore = create<State>((set, get) => ({
  project: p0,
  past: [],
  future: [],
  tab: 'levels',
  saveError: false,
  recovered: init.recovered,
  dismissRecovered: () => set({ recovered: null }),
  sel: {
    metatile: 1, sprite: p0.sprites[0]?.id ?? '', frame: 0,
    formation: p0.formations[0]?.id ?? '', level: p0.levels[0]?.id ?? '', enemy: p0.enemyTypes[0]?.id ?? '', weapon: p0.player.weaponId, stage: 0, song: '', sfx: '', levelTool: 'brush',
  },
  edit: (fn, coalesce) => {
    const { project, past } = get();
    const next = produce(project, fn);
    if (next === project) return;
    const now = Date.now();
    const merge = coalesce !== undefined && coalesce === lastCoalesce && now - lastCoalesceTime < 1500;
    lastCoalesce = coalesce;
    lastCoalesceTime = now;
    set({ project: next, past: merge ? past : [...past.slice(-MAX_HISTORY), project], future: [] });
  },
  undo: () => {
    const { past, project, future } = get();
    if (!past.length) return;
    lastCoalesce = undefined;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future] });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length) return;
    lastCoalesce = undefined;
    set({ project: future[0], past: [...past, project], future: future.slice(1) });
  },
  setTab: (tab) => set({ tab }),
  select: (s) => set({ sel: { ...get().sel, ...s } }),
  focus: null,
  goto: ({ tab, id, events, pos, stage }) => {
    const s: Partial<State['sel']> = id === undefined ? {} : tab === 'sprites' ? { sprite: id, frame: 0 }
      : tab === 'levels' ? { level: id } : tab === 'formations' ? { formation: id } : tab === 'objects' ? { enemy: id } : tab === 'upgrades' ? { weapon: id, stage: stage ?? 0 } : {};
    if (tab === 'levels' && (events || pos !== undefined)) s.levelTool = 'events';
    set({ tab, sel: { ...get().sel, ...s }, focus: tab === 'levels' && pos !== undefined ? { pos } : null });
  },
  /** Ersetzt das Projekt als normaler Undo-Schritt */
  load: (p) => {
    const { project, past } = get();
    lastCoalesce = undefined;
    set({
      project: p, past: [...past.slice(-MAX_HISTORY), project], future: [],
      // Pinsel 1 statt 0: Pinsel 0 ist in den Vorlagen leer, der erste Strich bliebe unsichtbar
      sel: {
        metatile: p.metatiles.length > 1 ? 1 : 0, sprite: p.sprites[0]?.id ?? '', frame: 0, formation: p.formations[0]?.id ?? '',
        level: p.levels[0]?.id ?? '', enemy: p.enemyTypes[0]?.id ?? '', weapon: p.player.weaponId, stage: 0, song: '', sfx: '', levelTool: 'brush',
      },
    });
  },
}));

// Autosave (entprellt)
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.project === prev.project && s.recovered === prev.recovered) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const st = useStore.getState();
    let ok = true;
    if (st.recovered && !st.recovered.key) ok = false; // alter Stand liegt nur noch unter KEY
    else try { localStorage.setItem(KEY, JSON.stringify(st.project)); } catch { ok = false; }
    if (ok === useStore.getState().saveError) useStore.setState({ saveError: !ok });
  }, 400);
});

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
export const useProject = () => useStore((s) => s.project);
