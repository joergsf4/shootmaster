import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoProject, createTemplateProject } from '@sms/core';

const KEY = 'sms-shmup-project-v1';

/** Store frisch laden mit vorgegebenem localStorage-Inhalt */
async function freshStore(data: Record<string, string>, quota = Infinity) {
  const mem = new Map(Object.entries(data));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { if (mem.size >= quota && !mem.has(k)) throw new Error('voll'); mem.set(k, v); },
  });
  vi.resetModules();
  const { useStore } = await import('../src/store');
  return { useStore, mem };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Editor-Store: kein stiller Datenverlust', () => {
  it('sichert einen ungültigen gespeicherten Stand, bevor das Demo ihn überschreibt', async () => {
    vi.useFakeTimers();
    const bad = JSON.stringify({ ...createDemoProject(), levels: [{ id: 'x' }] });
    const { useStore, mem } = await freshStore({ [KEY]: bad });
    const r = useStore.getState().recovered!;
    expect(r.error).toBe('Ungültiges Level');
    expect(mem.get(r.key!)).toBe(bad);
    useStore.getState().edit((d) => { d.name = 'neu'; });
    vi.advanceTimersByTime(500);
    expect(JSON.parse(mem.get(KEY)!).name).toBe('neu');
    expect(mem.get(r.key!)).toBe(bad);
  });

  it('überschreibt den alten Stand nicht, wenn die Sicherung fehlschlägt', async () => {
    vi.useFakeTimers();
    const { useStore, mem } = await freshStore({ [KEY]: '{kaputt' }, 1);
    expect(useStore.getState().recovered!.key).toBeNull();
    useStore.getState().edit((d) => { d.name = 'neu'; });
    vi.advanceTimersByTime(500);
    expect(mem.get(KEY)).toBe('{kaputt');
    expect(useStore.getState().saveError).toBe(true);
    useStore.getState().dismissRecovered(); // Nutzer hat heruntergeladen oder verzichtet
    vi.advanceTimersByTime(500);
    expect(JSON.parse(mem.get(KEY)!).name).toBe('neu');
  });

  it('Laden ist ein normaler Undo-Schritt', async () => {
    const { useStore } = await freshStore({});
    const before = useStore.getState().project;
    useStore.getState().load(createTemplateProject('v'));
    expect(useStore.getState().project.levels[0].orientation).toBe('v');
    useStore.getState().undo();
    expect(useStore.getState().project).toBe(before);
    useStore.getState().redo();
    expect(useStore.getState().project.name).toBe('Neues Spiel (vertikal)');
  });

  it('Sprung aus dem Problem-Panel wechselt Tab und Auswahl', async () => {
    const { useStore } = await freshStore({});
    useStore.getState().select({ frame: 2 });
    useStore.getState().goto({ tab: 'sprites', id: 'spr-x' });
    expect(useStore.getState().tab).toBe('sprites');
    expect(useStore.getState().sel).toMatchObject({ sprite: 'spr-x', frame: 0 });
    useStore.getState().goto({ tab: 'objects' });
    expect(useStore.getState().tab).toBe('objects');
    expect(useStore.getState().sel.sprite).toBe('spr-x');
  });
});
