import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoProject, createTemplateProject } from '@sms/core';
import { isTextEntry } from '../src/keys';
import { parseNum } from '../src/components/NumberInput';

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

  it('Sprung zu einem Level-Ereignis öffnet das Ereignis-Werkzeug und merkt sich die Position', async () => {
    const { useStore } = await freshStore({});
    const lv = useStore.getState().project.levels[1].id;
    useStore.getState().goto({ tab: 'levels', id: lv, events: true, pos: 94 });
    expect(useStore.getState().sel).toMatchObject({ level: lv, levelTool: 'events' });
    expect(useStore.getState().focus).toEqual({ pos: 94 });
    useStore.getState().select({ levelTool: 'brush' });
    useStore.getState().goto({ tab: 'levels', id: lv, events: true }); // „keine Gegner-Ereignisse“: ohne Position
    expect(useStore.getState().sel.levelTool).toBe('events');
    expect(useStore.getState().focus).toBeNull();
    useStore.getState().select({ levelTool: 'brush' });
    useStore.getState().goto({ tab: 'levels', id: lv }); // z. B. fehlender Pinsel: Werkzeug bleibt
    expect(useStore.getState().sel.levelTool).toBe('brush');
  });
});

describe('Zahlenfelder: ein Undo-Schritt je Eingabe', () => {
  it.each([
    ['25', 25], ['', null], ['abc', null], ['300', 255], ['-3', 1], ['2,6', 3],
  ])('„%s“ → %s (1..255)', (text, want) => {
    expect(parseNum(text, 1, 255)).toBe(want);
  });
  it('rundet auf die Schrittweite', () => {
    expect(parseNum('1.3', 0.5, 4, 0.25)).toBe(1.25);
    expect(parseNum('0.1', 0.5, 4, 0.25)).toBe(0.5);
  });
  it('Spinner-Klicks eines Feldes (gleicher Schlüssel) sind ein Undo-Schritt, eine getippte Eingabe ein eigener', async () => {
    const { useStore } = await freshStore({});
    const s = useStore.getState;
    const hp0 = s().project.enemyTypes[0].hp;
    for (let i = 1; i <= 3; i++) s().edit((d) => { d.enemyTypes[0].hp = hp0 + i; }, ':r1:');
    s().edit((d) => { d.enemyTypes[0].hp = 50; });
    s().undo();
    expect(s().project.enemyTypes[0].hp).toBe(hp0 + 3);
    s().undo();
    expect(s().project.enemyTypes[0].hp).toBe(hp0);
  });
});

describe('Editor-Store: Einstieg', () => {
  it('nach dem Laden ist Pinsel 1 gewählt (Pinsel 0 ist leer) und das Level-Werkzeug zurückgesetzt', async () => {
    const { useStore } = await freshStore({});
    useStore.getState().select({ levelTool: 'events', metatile: 3 });
    useStore.getState().load(createTemplateProject('h'));
    expect(useStore.getState().sel).toMatchObject({ metatile: 1, levelTool: 'brush' });
    const one = createTemplateProject('h');
    one.metatiles = one.metatiles.slice(0, 1);
    useStore.getState().load(one);
    expect(useStore.getState().sel.metatile).toBe(0);
  });
});

describe('isTextEntry: wo Tastenkürzel nicht greifen', () => {
  const el = (tagName: string, type = '', isContentEditable = false) => ({ tagName, type, isContentEditable }) as unknown as EventTarget;
  it.each([
    ['Textfeld', el('INPUT', 'text'), true],
    ['Zahlenfeld', el('INPUT', 'number'), true],
    ['TEXTAREA', el('TEXTAREA'), true],
    ['contenteditable', el('DIV', '', true), true],
    ['Regler', el('INPUT', 'range'), false],
    ['Checkbox', el('INPUT', 'checkbox'), false],
    ['Auswahlfeld', el('SELECT', 'select-one'), false],
    ['Knopf', el('BUTTON', 'submit'), false],
    ['window', null, false],
  ])('%s → %s', (_, t, want) => {
    expect(isTextEntry(t as EventTarget | null)).toBe(want);
  });
});
