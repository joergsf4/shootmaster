import { create } from 'zustand';
import { produce, type Draft } from 'immer';
import { createDemoProject, upgradeProject, validateProject, type Project } from '@sms/core';

const KEY = 'sms-shmup-project-v1';
const MAX_HISTORY = 200;

export type Tab = 'palette' | 'tiles' | 'sprites' | 'objects' | 'formations' | 'levels' | 'sound';

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  tab: Tab;
  /** Auswahl je Editor */
  sel: { metatile: number; sprite: string; frame: number; formation: string; level: string; enemy: string; song: string; sfx: string };
  /** Änderung mit Undo-Schritt */
  edit: (fn: (d: Draft<Project>) => void, coalesce?: string) => void;
  undo: () => void;
  redo: () => void;
  setTab: (t: Tab) => void;
  select: (s: Partial<State['sel']>) => void;
  load: (p: Project) => void;
  /** Autosave fehlgeschlagen → Nutzer muss exportieren */
  saveError: boolean;
}

function initial(): Project {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const p = upgradeProject(JSON.parse(s));
      if (!validateProject(p)) return p as Project;
    }
  } catch { /* ignorieren */ }
  return createDemoProject();
}

let lastCoalesce: string | undefined;
let lastCoalesceTime = 0;

const p0 = initial();
export const useStore = create<State>((set, get) => ({
  project: p0,
  past: [],
  future: [],
  tab: 'levels',
  saveError: false,
  sel: {
    metatile: 1, sprite: p0.sprites[0]?.id ?? '', frame: 0,
    formation: p0.formations[0]?.id ?? '', level: p0.levels[0]?.id ?? '', enemy: p0.enemyTypes[0]?.id ?? '', song: '', sfx: '',
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
  load: (p) => set({
    project: p, past: [], future: [],
    sel: { metatile: 0, sprite: p.sprites[0]?.id ?? '', frame: 0, formation: p.formations[0]?.id ?? '', level: p.levels[0]?.id ?? '', enemy: p.enemyTypes[0]?.id ?? '', song: '', sfx: '' },
  }),
}));

// Autosave (entprellt)
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    let ok = true;
    try { localStorage.setItem(KEY, JSON.stringify(s.project)); } catch { ok = false; }
    if (ok === useStore.getState().saveError) useStore.setState({ saveError: !ok });
  }, 400);
});

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
export const useProject = () => useStore((s) => s.project);
