import { afterEach, describe, expect, it } from 'vitest';
import { bakePath, buildRom, compileProject, createDemoProject, validateProject, decodeTile, encodeNameEntry, encodeTile, engineBinary, framePositions, rgbToSms, smsToRgb } from '../src/index';
import { SMS, BTN, PSG } from '../../sms-emu/src/index';
import { bench1, bench2, bench3, fanScene, ring16, roam, wiggle } from './scenes';

// Die Emulator-Tests laufen synchron; ohne Makrotask dazwischen beantwortet der Worker keine RPCs und Vitest meldet nach 60 s „Timeout calling onTaskUpdate“
afterEach(() => new Promise((r) => setTimeout(r)));
import { BUDGET_GREEN, BUDGET_YELLOW, COST, ENGINE_SYMBOLS, budgetLevel, createTemplateProject, frameCost, layoutSprites, type FrameLoad, layoutBgTiles, levelCamMax, levelDuration, lintProject, peakEnemies, shrinkLoss, stackNeighbor, periodTable, shotVelocity, spriteUsers, upgradeBudget, upgradeProject, weaponPreset, weaponUsers, type EnemyShot, type Level, type LevelEvent, type Metatile, type Weapon } from '../src/index';

describe('Hardware-Primitive', () => {
  it('kodiert Tiles planar 4bpp und zurück', () => {
    const px = Array.from({ length: 64 }, (_, i) => i % 16);
    const bytes = encodeTile(px);
    expect(bytes).toHaveLength(32);
    expect(decodeTile(bytes)).toEqual(px);
    // erste Zeile: Pixel 0..7 = Farben 0..7 → Plane0 = 01010101
    expect(bytes[0]).toBe(0b01010101);
    expect(bytes[1]).toBe(0b00110011);
    expect(bytes[2]).toBe(0b00001111);
    expect(bytes[3]).toBe(0);
  });
  it('Name-Table-Eintrag mit Flags', () => {
    expect(encodeNameEntry({ tile: 0x123, hflip: true, vflip: true, palette: 1, priority: true })).toEqual([0x23, 0x1f]);
  });
  it('Farbumrechnung', () => {
    expect(smsToRgb(0x3f)).toEqual([255, 255, 255]);
    expect(rgbToSms(255, 0, 0)).toBe(0x03);
    expect(rgbToSms(0, 0, 170)).toBe(0x20);
  });
});

describe('Pfade', () => {
  it('backt Pfad mit Abweichung ≤ 1 px', () => {
    const pts = [{ x: 264, y: 30 }, { x: 140, y: 90 }, { x: -40, y: 30 }];
    const { start, bytes } = bakePath(pts, 1.5);
    const ref = framePositions(pts, 1.5);
    let x = start.x, y = start.y, k = 0;
    for (let i = 0; bytes[i] !== 0; i += 3) {
      const n = bytes[i], dx = (bytes[i + 1] << 24) >> 24, dy = (bytes[i + 2] << 24) >> 24;
      for (let j = 0; j < n; j++) { x += dx; y += dy; k++; expect(Math.abs(x - ref[k].x)).toBeLessThanOrEqual(1); expect(Math.abs(y - ref[k].y)).toBeLessThanOrEqual(1); }
    }
    expect(k).toBe(ref.length - 1);
  });
});

describe('ROM', () => {
  const { rom } = buildRom(engineBinary(), createDemoProject());
  it('hat gültigen Header und Checksumme', () => {
    expect(String.fromCharCode(...rom.slice(0x7ff0, 0x7ff8))).toBe('TMR SEGA');
    let sum = 0;
    for (let i = 0; i < 0x7ff0; i++) sum = (sum + rom[i]) & 0xffff;
    expect(rom[0x7ffa] | (rom[0x7ffb] << 8)).toBe(sum);
    expect(rom.length & (rom.length - 1)).toBe(0);
  });
  // Spielt ein Level 900 Frames lang mit Dauerfeuer und meldet, was passiert ist
  const play = (levelIndex: number) => {
    const p = createDemoProject();
    p.levels = [p.levels[levelIndex], ...p.levels.filter((_, i) => i !== levelIndex)];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let maxEnemies = 0, sawShot = false;
    for (let f = 0; f < 900; f++) {
      sms.buttons = BTN.b1;
      sms.runFrame();
      const r = sms.ram;
      maxEnemies = Math.max(maxEnemies, [...Array(16)].filter((_, i) => r[0x200 + i * 16] >= 2).length);
      if ([...Array(10)].some((_, i) => r[0x300 + i * 16] === 2)) sawShot = true;
    }
    return { cam: sms.ram[6] | (sms.ram[7] << 8), maxEnemies, sawShot, sms };
  };
  it.each([[0, 'horizontal'], [1, 'vertikal']])('Level %i (%s) läuft im Emulator: scrollt, spawnt Gegner, Spieler schießt', (i) => {
    const r = play(i as number);
    expect(r.cam).toBeGreaterThan(400);
    expect(r.maxEnemies).toBeGreaterThanOrEqual(5);
    expect(r.sawShot).toBe(true);
  });
  it('vertikales Level baut die Name Table korrekt auf (Startbild = Kartenzeilen 0..11)', () => {
    const p = createDemoProject();
    const lv = p.levels[1];
    p.levels = [lv];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 30; f++) sms.runFrame(); // Kamera noch bei 0 bzw. knapp darüber
    const nt = sms.vdp.vram;
    // Tile-Zeile 0 (unten im Bild) liegt in Name-Table-Zeile 27, linkes unteres Viertel des Metatiles
    const { refs } = layoutBgTiles(p.metatiles);
    for (let c = 0; c < 16; c++) {
      const r = refs[lv.map[c]];
      const addr = 0x3800 + 27 * 64 + c * 4;
      expect(nt[addr]).toBe(r[2].tile);
      expect(nt[addr + 2]).toBe(r[3].tile);
    }
  });
});

describe('Spielregeln', () => {
  it('Schuss erscheint nicht am anderen Bildschirmrand, wenn der Versatz überläuft', () => {
    const p = createDemoProject();
    p.weapons[0].levels[0].emitters[0].ahead = 26; // Schuss 30 px rechts von der Schiffskante (früher shotOffset.x = 30)
    p.levels[0].events = [];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let wrapped = false;
    for (let f = 0; f < 400; f++) {
      sms.buttons = BTN.right | (f > 200 ? BTN.b1 : 0);
      sms.runFrame();
      for (let i = 0; i < 10; i++) if (sms.ram[0x300 + i * 16] === 2 && sms.ram[0x302 + i * 16] < 100) wrapped = true;
    }
    expect(sms.ram[0x82]).toBe(240);
    expect(wrapped).toBe(false);
  });
  it('Wellen hinter dem Levelende werden ans Ende gelegt statt verworfen', () => {
    const p = createDemoProject();
    p.levels[0].length = 40; // Kamera endet bei 384
    const bank = compileProject(p).banks[1];
    const evPtr = (bank[0x18] | (bank[0x19] << 8)) - 0x4000;
    const pos: number[] = [];
    for (let a = evPtr; (bank[a] | (bank[a + 1] << 8)) !== 0xffff; a += 4) pos.push(bank[a] | (bank[a + 1] << 8));
    expect(Math.max(...pos)).toBe(384);
    expect(pos).toHaveLength(p.levels[0].events.length);
  });
});

describe('Projektdatei prüfen', () => {
  it('akzeptiert das Demo-Projekt', () => {
    expect(validateProject(JSON.parse(JSON.stringify(createDemoProject())))).toBeNull();
  });
  it.each([
    ['kein Objekt', null],
    ['falsche Version', { ...createDemoProject(), formatVersion: 99 }],
    ['Level ohne Karte', { ...createDemoProject(), levels: [{ id: 'x' }] }],
    ['fehlende Sprites', { ...createDemoProject(), sprites: undefined }],
    ['kaputter Pinsel', { ...createDemoProject(), metatiles: [{ pixels: [1, 2, 3] }] }],
  ])('lehnt ab: %s', (_, p) => {
    expect(validateProject(p)).not.toBeNull();
  });
});

describe('Sound', () => {
  it('PSG erzeugt die eingestellte Tonhöhe', () => {
    const psg = new PSG();
    const period = periodTable()[21]; // A4 = 440 Hz
    psg.write(0x80 | (period & 15)); psg.write(period >> 4); psg.write(0x90); // Kanal 0, laut
    const s = psg.render(44100, 44100);
    let flips = 0;
    for (let i = 1; i < s.length; i++) if (Math.sign(s[i]) !== Math.sign(s[i - 1])) flips++;
    expect(Math.abs(flips / 2 - 440)).toBeLessThan(5);
  });
  it('Engine spielt die Levelmusik und den Schuss-Effekt', () => {
    const p = createDemoProject();
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    const melodyPeriod = periodTable()[p.songs[0].channels[0].steps[0] - 2];
    let heardMelody = false, heardShot = false;
    for (let f = 0; f < 200; f++) {
      sms.buttons = f > 100 ? BTN.b1 : 0;
      sms.runFrame();
      if (sms.psg.regs[0] === melodyPeriod && sms.psg.regs[1] < 15) heardMelody = true;
      if (sms.psg.regs[5] < 15) heardShot = true; // Kanal 3 ist im Song still → nur der Laser
    }
    expect(heardMelody).toBe(true);
    expect(heardShot).toBe(true);
  });
  it('Soundtest-ROM spielt einen Effekt und verstummt danach', () => {
    const p = createDemoProject();
    const sms = new SMS(buildRom(engineBinary(), p, { soundTest: { sfx: 'sfx-boom' } }).rom);
    let loud = false;
    for (let f = 0; f < 30; f++) { sms.runFrame(); if (sms.psg.regs[7] < 10 && sms.psg.regs[6] === 6) loud = true; }
    for (let f = 0; f < 30; f++) sms.runFrame();
    expect(loud).toBe(true);
    expect(sms.psg.regs[7]).toBe(15);
  });
  it('alte Projekte ohne Sound bekommen Standard-Sounds', () => {
    const old = JSON.parse(JSON.stringify(createDemoProject()));
    delete old.songs; delete old.sfx; delete old.sounds;
    expect(validateProject(old)).not.toBeNull();
    expect(validateProject(upgradeProject(old))).toBeNull();
  });
});

describe('Pinsel', () => {
  it('teilt gleiche und gespiegelte 8×8-Kacheln automatisch', () => {
    const quarter = Array.from({ length: 64 }, (_, i) => (i % 8 < 3 && i < 40 ? 5 : 0)); // in beide Richtungen asymmetrisch
    const px = new Array(256).fill(0);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      px[y * 16 + x] = quarter[y * 8 + x];            // oben links: Original
      px[y * 16 + 8 + x] = quarter[y * 8 + 7 - x];    // oben rechts: gespiegelt
      px[(8 + y) * 16 + x] = quarter[(7 - y) * 8 + x]; // unten links: vertikal gespiegelt
      px[(8 + y) * 16 + 8 + x] = 0;                   // unten rechts: leer
    }
    const { tiles, refs } = layoutBgTiles([{ pixels: px }]);
    expect(tiles).toHaveLength(2);
    expect(refs[0][1]).toEqual({ tile: 0, hflip: true, priority: undefined });
    expect(refs[0][2]).toEqual({ tile: 0, vflip: true, priority: undefined });
  });
  it('Pinsel ändern sich nicht gegenseitig (eigene Pixel je Pinsel)', () => {
    const p = createDemoProject();
    p.metatiles[0].pixels[0] = 7;
    expect(p.metatiles.slice(1).every((m) => m !== p.metatiles[0])).toBe(true);
    expect(validateProject(p)).toBeNull();
  });
  it('wandelt Projekte im alten Kachel-Format (1) bildgleich um', () => {
    const tile = Array.from({ length: 64 }, (_, i) => i % 16);
    const old = { ...JSON.parse(JSON.stringify(createDemoProject())), formatVersion: 1, tiles: [tile],
      metatiles: [{ tiles: [{ tile: 0 }, { tile: 0, hflip: true }, { tile: 0 }, { tile: 0, priority: true }] }] };
    const up = upgradeProject(old) as ReturnType<typeof createDemoProject>;
    expect(validateProject(up)).toBeNull();
    expect('tiles' in up).toBe(false);
    expect(up.metatiles[0].pixels[0]).toBe(tile[0]);
    expect(up.metatiles[0].pixels[8]).toBe(tile[7]); // gespiegelt
    expect(up.metatiles[0].priority).toBe(true);
  });
});

describe('Hintergrund-Kollision', () => {
  // Spieler fliegt ohne Gegner in den Boden (horizontal) bzw. die Seitenwand (vertikal)
  const livesAfter = (levelIndex: number, dir: number, solid: boolean) => {
    const p = createDemoProject();
    p.levels = [p.levels[levelIndex]];
    p.levels[0].events = [];
    if (!solid) p.metatiles.forEach((m) => { m.solid = false; });
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 200; f++) { sms.buttons = dir; sms.runFrame(); } // < 3 Treffer, sonst Neustart mit vollen Leben
    return sms.ram[0x1e];
  };
  it.each([[0, BTN.down, 'horizontal: Boden'], [1, BTN.left, 'vertikal: Metallwand']])('Level %i – %s kostet ein Leben, nur wenn „tödlich“', (lv, dir) => {
    expect(livesAfter(lv as number, dir as number, true)).toBeLessThan(3);
    expect(livesAfter(lv as number, dir as number, false)).toBe(3);
  });
});

describe('Vorlagen „Neu“', () => {
  it.each(['h', 'v'] as const)('leere Vorlage %s ist gültig, läuft und spawnt die Formation, sobald sie platziert ist', (o) => {
    const p = createTemplateProject(o);
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toBeNull();
    expect(p.levels[0].events).toEqual([]);
    p.levels[0].events.push({ pos: 0, type: 'spawn', formationId: p.formations[0].id });
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let maxEnemies = 0, sawShot = false;
    for (let f = 0; f < 300; f++) {
      sms.buttons = BTN.b1;
      sms.runFrame();
      maxEnemies = Math.max(maxEnemies, [...Array(16)].filter((_, i) => sms.ram[0x200 + i * 16] >= 2).length);
      if ([...Array(10)].some((_, i) => sms.ram[0x300 + i * 16] === 2)) sawShot = true;
    }
    expect(sms.ram[6] | (sms.ram[7] << 8)).toBeGreaterThan(100);
    expect(maxEnemies).toBeGreaterThanOrEqual(1);
    expect(sawShot).toBe(true);
  });
});

describe('Problem-Panel (lintProject)', () => {
  const msgs = (p: ReturnType<typeof createDemoProject>, sev: 'error' | 'warn') => lintProject(p).filter((d) => d.severity === sev).map((d) => d.msg);
  // Rechenzeit: ohne Abschüsse kommen beide Demo-Level knapp über ein Bild (gemessen bis 61 170 Takte) – ehrlich gelb, nie rot
  it('Demo-Projekt hat keine Fehler, nur die Rechenzeit-Hinweise (gelb)', () => {
    const d = lintProject(createDemoProject());
    expect(d.filter((x) => x.severity === 'error')).toEqual([]);
    expect(d.every((x) => x.msg.includes('verlangsamen'))).toBe(true);
  });
  it('meldet die stillen Fälle des Compilers', () => {
    const p = createDemoProject();
    const lv = p.levels[0];
    lv.events.push({ pos: 100, type: 'spawn', formationId: 'weg' });
    lv.map[0] = p.metatiles.length; // würde per Modulo zu Pinsel 0
    lv.map[1] = -1;
    p.formations[0].count = 18;
    const d = lintProject(p);
    expect(d).toContainEqual({ severity: 'error', msg: `Level „${lv.name}“: Ereignis bei 100 px verweist auf gelöschte Formation – neu wählen oder löschen`, ref: { tab: 'levels', id: lv.id, events: true, pos: 100 } });
    expect(d).toContainEqual({ severity: 'error', msg: `Level „${lv.name}“: 2 Felder mit fehlendem Pinsel – neu malen`, ref: { tab: 'levels', id: lv.id } });
    expect(d).toContainEqual({ severity: 'warn', msg: `Formation „${p.formations[0].name}“: 18 Gegner, höchstens 16 erscheinen – Anzahl senken`, ref: { tab: 'formations', id: p.formations[0].id } });
  });
  it('meldet tote Sprites/Gegnertypen, kurze Pfade, Ereignisse hinter dem Ende, leere Level und Unbenutztes', () => {
    const p = createDemoProject();
    const [f0] = p.formations;
    p.enemyTypes[0].spriteId = 'weg';
    f0.enemyTypeId = 'weg';
    f0.points = f0.points.slice(0, 1);
    p.levels[0].events[0].pos = 99999;
    p.levels[1].events = [];
    p.sprites.push({ ...p.sprites[0], id: 'neu', name: 'Neu' });
    expect(msgs(p, 'error')).toEqual(expect.arrayContaining([
      `Gegnertyp „${p.enemyTypes[0].name}“: Sprite fehlt – neu wählen`,
      `Formation „${f0.name}“: Gegnertyp fehlt – neu wählen`,
      `Formation „${f0.name}“: Pfad braucht mind. 2 Punkte – in die Fläche klicken`,
    ]));
    expect(msgs(p, 'warn')).toEqual(expect.arrayContaining([
      `Level „${p.levels[0].name}“: Ereignis bei 99999 px liegt hinter dem Levelende und kommt schon bei ${levelCamMax(p.levels[0])} px – verschieben`,
      `Level „${p.levels[1].name}“: keine Gegner-Ereignisse – mit „◆ Ereignisse“ Formationen setzen`,
      'Sprite „Neu“ wird nicht verwendet – zuordnen oder löschen',
    ]));
    // Sprungziele: Ereignis-Werkzeug, bei Ereignissen mit Position
    const ref = (start: string) => lintProject(p).find((d) => d.msg.startsWith(start))!.ref;
    expect(ref(`Level „${p.levels[1].name}“: keine Gegner`)).toEqual({ tab: 'levels', id: p.levels[1].id, events: true });
    expect(ref(`Level „${p.levels[0].name}“: Ereignis bei 99999`)).toEqual({ tab: 'levels', id: p.levels[0].id, events: true, pos: 99999 });
  });
  it('zählt Felder mit fehlendem Pinsel in der Einzahl richtig', () => {
    const p = createDemoProject();
    p.levels[0].map[0] = -1;
    expect(msgs(p, 'error')).toContain(`Level „${p.levels[0].name}“: 1 Feld mit fehlendem Pinsel – neu malen`);
  });
  it('kaputte Formation ohne Verwendung ist nur eine Warnung (der Compiler baut sie nicht ein)', () => {
    const p = createTemplateProject('h');
    p.formations[0].points = [];
    expect(msgs(p, 'error')).toEqual([]);
    expect(() => buildRom(engineBinary(), p)).not.toThrow();
  });
  it('nennt die Verwender eines Sprites', () => {
    const p = createDemoProject();
    const e = p.enemyTypes[0];
    expect(spriteUsers(p, e.spriteId)).toContainEqual({ label: `Gegnertyp „${e.name}“`, ref: { tab: 'objects', id: e.id } });
    expect(spriteUsers(p, p.player.spriteId)[0].label).toBe('Spieler');
  });
  // Zwei 10er-Ketten kurz nacheinander: die Engine hat nur 16 Gegner-Slots und verwirft den Rest still
  it.each([[16, 20, 16], [300, 10, 10]])('Ereignisse bei 0 und %i: Vorhersage %i gleichzeitig, Engine zeigt höchstens %i', (pos2, predicted, inGame) => {
    const p = createTemplateProject('h');
    const f = p.formations[0];
    f.count = 10;
    p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: f.id }, { pos: pos2, type: 'spawn', formationId: f.id }];
    expect(peakEnemies(p, p.levels[0]).count).toBe(predicted);
    expect(lintProject(p).some((d) => d.msg.includes('Gegner gleichzeitig (bei'))).toBe(predicted > 16);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let max = 0;
    for (let fr = 0; fr < 700; fr++) { sms.runFrame(); max = Math.max(max, [...Array(16)].filter((_, i) => sms.ram[0x200 + i * 16] !== 0).length); }
    expect(max).toBe(inGame);
  });
});

describe('„Ab hier spielen“ (startCam, unverwundbar)', () => {
  it('Pause (NMI) und weiter: das Spiel läuft danach weiter', () => {
    const p = createDemoProject();
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    const cam = () => sms.ram[6] | (sms.ram[7] << 8);
    for (let f = 0; f < 60; f++) sms.runFrame();
    sms.pause(); for (let f = 0; f < 30; f++) sms.runFrame();
    const c0 = cam();
    sms.pause(); for (let f = 0; f < 60; f++) sms.runFrame();
    expect(cam()).toBeGreaterThan(c0 + 20);
  });
  // Prüft jedes sichtbare Pixel: Name-Table-Eintrag unter Scrollregister = Pinsel-Viertel der Karte an Kamera + Bildschirmposition
  const screenMismatches = (sms: SMS, lv: Level, metatiles: Metatile[]) => {
    const { refs } = layoutBgTiles(metatiles);
    const cam = sms.ram[6] | (sms.ram[7] << 8);
    const hs = sms.vdp.regs[8], vs = sms.vdp.regs[9];
    const bad: string[] = [];
    for (let y = 0; y < 192; y++) for (let x = lv.orientation === 'h' ? 8 : 0; x < 256; x++) { // H: linke Spalte ist maskiert
      let cell: number, q: number;
      if (lv.orientation === 'h') {
        const wx = cam + x;
        cell = (wx >> 4) * 12 + (y >> 4);
        q = ((y >> 3) & 1) * 2 + ((wx >> 3) & 1);
      } else {
        const a = cam + 191 - y; // Pixel ab Levelanfang (unten)
        cell = (a >> 4) * 16 + (x >> 4);
        q = ((a >> 3) & 1 ? 0 : 2) + ((x >> 3) & 1);
      }
      const want = encodeNameEntry(refs[lv.map[cell]][q]);
      const addr = 0x3800 + (((y + vs) % 224) >> 3) * 64 + (((x - hs) & 0xff) >> 3) * 2;
      if (sms.vdp.vram[addr] !== want[0] || sms.vdp.vram[addr + 1] !== want[1]) bad.push(`${x},${y}`);
    }
    return bad.slice(0, 5); // erste Abweichungen reichen
  };
  const project = (levelIndex: number) => {
    const p = createDemoProject();
    const lv = p.levels[levelIndex];
    p.levels = [lv];
    lv.map = lv.map.map((_, i) => (i * 7 + (i >> 4)) % p.metatiles.length); // möglichst verschiedene Nachbarn
    return { p, lv };
  };
  it.each([[0, 300], [0, 13], [1, 300], [1, 13]])('Level %i ab Kamera %i: Startbild und weiteres Scrollen stimmen mit der Karte überein', (li, startCam) => {
    const { p, lv } = project(li);
    const sms = new SMS(buildRom(engineBinary(), p, { startCam }).rom);
    for (let f = 0; f < 30; f++) sms.runFrame(); // Start (VRAM löschen, Startbild) dauert einige Frames
    expect(sms.ram[6] | (sms.ram[7] << 8)).toBeGreaterThanOrEqual(startCam);
    sms.pause(); sms.runFrame(); sms.runFrame(); // Pause: Kamera steht, Scrollregister und Streaming sind nachgezogen
    expect(screenMismatches(sms, lv, p.metatiles)).toEqual([]);
    sms.pause();
    for (let f = 0; f < 150; f++) sms.runFrame();
    sms.pause(); sms.runFrame(); sms.runFrame();
    expect(sms.ram[6] | (sms.ram[7] << 8)).toBeGreaterThan(startCam + 40);
    expect(screenMismatches(sms, lv, p.metatiles)).toEqual([]);
  });
  it('Ereignisse vor startCam entfallen, startCam wird aufs Levelende geklemmt, nur das erste Level startet versetzt', () => {
    const p = createDemoProject();
    const lv = p.levels[0];
    lv.events = [{ pos: 100, type: 'spawn', formationId: p.formations[0].id }, { pos: 400, type: 'spawn', formationId: p.formations[1].id }, { pos: 99999, type: 'spawn', formationId: p.formations[0].id }];
    const read = (bank: Uint8Array) => {
      const evPtr = (bank[0x18] | (bank[0x19] << 8)) - 0x4000;
      const pos: number[] = [];
      for (let a = evPtr; (bank[a] | (bank[a + 1] << 8)) !== 0xffff; a += 4) pos.push(bank[a] | (bank[a + 1] << 8));
      return { cam: bank[0x28] | (bank[0x29] << 8), pos };
    };
    const d = compileProject(p, { startCam: 400 });
    expect(read(d.banks[1])).toEqual({ cam: 400, pos: [400, levelCamMax(lv)] });
    expect(read(d.banks[2]).cam).toBe(0);
    expect(read(compileProject(p, { startCam: 99999 }).banks[1])).toEqual({ cam: levelCamMax(lv), pos: [levelCamMax(lv)] });
    expect(read(compileProject(p).banks[1]).pos).toHaveLength(3);
  });
  it.each([[false, 0], [true, 3]])('unverwundbar=%s: Flug in den tödlichen Boden kostet %i… (Leben danach)', (invincible) => {
    const p = createDemoProject();
    p.levels = [p.levels[0]];
    p.levels[0].events = [];
    const sms = new SMS(buildRom(engineBinary(), p, { invincible }).rom);
    for (let f = 0; f < 200; f++) { sms.buttons = BTN.down; sms.runFrame(); }
    if (invincible) expect(sms.ram[0x1e]).toBe(3); else expect(sms.ram[0x1e]).toBeLessThan(3);
    expect(sms.ram[0x80 + 15]).toBeGreaterThan(0); // Treffer wird trotzdem angezeigt (Blinken)
  });
});

describe('Level-Ereignisse: Tempo, Musik, Warten, Checkpoint', () => {
  const cam = (sms: SMS) => sms.ram[6] | (sms.ram[7] << 8);
  const busy = (sms: SMS) => [...Array(16)].filter((_, i) => sms.ram[0x200 + i * 16] !== 0).length;
  const withEvents = (events: LevelEvent[]) => { const p = createTemplateProject('h'); p.levels[0].events = events; return p; };
  const evList = (bank: Uint8Array) => {
    const out: number[][] = [];
    for (let a = (bank[0x18] | (bank[0x19] << 8)) - 0x4000; (bank[a] | (bank[a + 1] << 8)) !== 0xffff; a += 4) out.push([bank[a] | (bank[a + 1] << 8), bank[a + 2], bank[a + 3]]);
    return out;
  };

  it('Compiler schreibt Typ und Parameter; „Ab hier“ übernimmt Tempo und Musik der weggelassenen Ereignisse', () => {
    const p = withEvents([
      { pos: 100, type: 'speed', speed: 1 },
      { pos: 100, type: 'music', musicId: '' },
      { pos: 300, type: 'waitClear' },
      { pos: 300, type: 'spawn', formationId: 'f-1' },
      { pos: 200, type: 'checkpoint' },
      { pos: 400, type: 'music', musicId: 'song-1' },
    ]);
    p.levels[0].musicId = 'song-1';
    const b = compileProject(p).banks[1];
    expect(evList(b)).toEqual([[100, 2, 16], [100, 3, 0xff], [200, 5, 0], [300, 4, 0], [300, 1, 0], [400, 3, 0]]);
    expect([b[3], b[0x25]]).toEqual([8, 0]);
    const s = compileProject(p, { startCam: 250 }).banks[1];
    expect(evList(s)).toEqual([[300, 4, 0], [300, 1, 0], [400, 3, 0]]);
    expect([s[3], s[0x25]]).toEqual([16, 0xff]);
  });

  it('Tempo: schneller ab 40, Stopp bei 200 – die Kamera bleibt dort stehen (und Lint warnt)', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 40, type: 'speed', speed: 2 }, { pos: 200, type: 'speed', speed: 0 }]);
    expect(lintProject(p)).toContainEqual({ severity: 'warn', msg: `Level „${p.levels[0].name}“: Kamera bleibt bei 200 px stehen (Tempo 0), das Level endet nie – an derselben Stelle ein Tempo-Ereignis anhängen`, ref: { tab: 'levels', id: p.levels[0].id, events: true, pos: 200 } });
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 200; f++) sms.runFrame();
    expect(cam(sms)).toBe(200); // mit 0,5 px/F wären es erst ~100
    for (let f = 0; f < 400; f++) sms.runFrame();
    expect(cam(sms)).toBe(200);
    p.levels[0].events.push({ pos: 200, type: 'speed', speed: 1 }); // gleiche Stelle, danach: geht weiter
    expect(lintProject(p).some((d) => d.msg.includes('Kamera bleibt'))).toBe(false);
  });

  it('Dauer: rechnet Tempo-Ereignisse und die Reststrecke bis zum Levelende ein; Stopp ohne Freigabe endet nie', () => {
    const p = withEvents([]);
    const lv = p.levels[0];
    lv.speed = 0.5;
    const end = levelCamMax(lv);
    expect(levelDuration(lv)).toEqual({ frames: end * 2, stopAt: null });
    lv.events = [{ pos: 100, type: 'speed', speed: 1 }];
    expect(levelDuration(lv)).toEqual({ frames: 200 + (end - 100), stopAt: null });
    lv.events.push({ pos: 300, type: 'speed', speed: 0 });
    expect(levelDuration(lv).stopAt).toBe(300);
    lv.events.push({ pos: 300, type: 'speed', speed: 2 });
    expect(levelDuration(lv)).toEqual({ frames: 200 + 200 + Math.ceil((end - 300) / 2), stopAt: null });
    // Engine: Tempo-Ereignisse verkürzen die Zeit bis zum Ende so wie vorhergesagt (±1 Frame je Tempowechsel; Startvorlauf fällt heraus)
    const run = () => { const sms = new SMS(buildRom(engineBinary(), p).rom); let f = 0; while (cam(sms) < end && f < 5000) { sms.runFrame(); f++; } return f; };
    const withSpeed = run(), events = lv.events;
    lv.events = [];
    expect(Math.abs((run() - withSpeed) - (levelDuration(lv).frames - levelDuration({ ...lv, events }).frames))).toBeLessThanOrEqual(3);
  });

  it('Stapel: früher/später findet nur Ereignisse an derselben Position', () => {
    const lv = withEvents([{ pos: 10, type: 'checkpoint' }, { pos: 20, type: 'waitClear' }, { pos: 10, type: 'speed', speed: 1 }]).levels[0];
    expect([stackNeighbor(lv, 0, -1), stackNeighbor(lv, 0, 1), stackNeighbor(lv, 2, -1), stackNeighbor(lv, 1, 1)]).toEqual([-1, 2, 0, -1]);
  });

  it('Kürzen: meldet abgeschnittene bemalte Spalten und Ereignisse, die ans Ende rücken', () => {
    const lv = withEvents([{ pos: 100, type: 'checkpoint' }, { pos: 500, type: 'checkpoint' }]).levels[0];
    lv.length = 64;
    lv.map = new Array(64 * 12).fill(0);
    expect(shrinkLoss(lv, 40)).toEqual({ cut: 0, events: 1 }); // Ende bei 384
    lv.map[50 * 12 + 3] = 1;
    expect(shrinkLoss(lv, 40)).toEqual({ cut: 24, events: 1 });
    expect(shrinkLoss(lv, 51)).toEqual({ cut: 0, events: 0 });
  });

  it('Musik: Wechsel auf einen Song und zurück zu Stille', () => {
    const p = withEvents([{ pos: 20, type: 'music', musicId: 'song-1' }, { pos: 100, type: 'music', musicId: '' }]);
    p.levels[0].musicId = '';
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    const song = () => sms.ram[0x40] | (sms.ram[0x41] << 8);
    for (let f = 0; f < 30; f++) sms.runFrame();
    expect(song()).toBe(0);
    for (let f = 0; f < 90; f++) sms.runFrame();
    expect(song()).not.toBe(0);
    for (let f = 0; f < 180; f++) sms.runFrame();
    expect(song()).toBe(0);
    expect([1, 3, 5].map((r) => sms.psg.regs[r])).toEqual([15, 15, 15]);
  });

  it('Warten: Kamera hält, bis alle Gegner-Slots frei sind, dann geht es weiter', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 10, type: 'waitClear' }]);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let held = 0, maxWhileBusy = 0;
    for (let f = 0; f < 600; f++) {
      sms.buttons = BTN.up; // Spieler aus der Flugbahn
      sms.runFrame();
      if (busy(sms)) maxWhileBusy = Math.max(maxWhileBusy, cam(sms));
      if (busy(sms) && cam(sms) === 10) held++;
    }
    expect(maxWhileBusy).toBe(10);
    expect(held).toBeGreaterThan(100);
    expect(cam(sms)).toBeGreaterThan(100);
  });

  it('„Warten“ zwischen zwei 8er-Ketten: Vorhersage und Engine sehen höchstens 8 gleichzeitig', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 8, type: 'waitClear' }, { pos: 16, type: 'spawn', formationId: 'f-1' }]);
    p.formations[0].count = 8;
    expect(peakEnemies(p, p.levels[0]).count).toBe(8);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let max = 0;
    for (let f = 0; f < 900; f++) { sms.runFrame(); max = Math.max(max, busy(sms)); }
    expect(max).toBe(8);
  });

  // Spieler fliegt in den tödlichen Boden, bis Game Over: Neustart an Kamera und mit Tempo des Checkpoints
  it.each([[true, 60], [false, 0]])('Checkpoint=%s: Neustart nach Game Over bei Kamera %i', (withCk, want) => {
    const p = createDemoProject();
    p.levels = [p.levels[0]];
    p.levels[0].events = [{ pos: 20, type: 'speed', speed: 1 }, ...(withCk ? [{ pos: 60, type: 'checkpoint' } as const] : [])];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let prev = 0, respawn = -1;
    for (let f = 0; f < 900 && respawn < 0; f++) {
      sms.buttons = BTN.down;
      sms.runFrame();
      if (cam(sms) < prev) respawn = cam(sms);
      prev = cam(sms);
    }
    expect(respawn).toBe(want);
    expect(sms.ram[0x1e]).toBe(3);
    for (let f = 0; f < 40; f++) sms.runFrame();
    // mit Checkpoint gilt dessen Tempo (1 px/F), ohne beginnt das Level mit 0,5 px/F von vorn
    expect(cam(sms) - want).toBeGreaterThanOrEqual(withCk ? 36 : 16);
  });

  it('Checkpoint gilt nur im eigenen Level: Game Over im nächsten Level startet dort von vorn', () => {
    const p = createDemoProject();
    const short = { ...p.levels[0], id: 'kurz', length: 17, map: p.levels[0].map.slice(0, 17 * 12), events: [{ pos: 8, type: 'checkpoint' } as const] };
    p.levels = [short, { ...p.levels[0], events: [] }];
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let prev = 0, respawn = -1;
    for (let f = 0; f < 1200 && respawn < 0; f++) {
      sms.buttons = sms.ram[0x13] === 1 ? BTN.down : 0;
      sms.runFrame();
      if (sms.ram[0x13] === 1 && cam(sms) < prev) respawn = cam(sms);
      prev = sms.ram[0x13] === 1 ? cam(sms) : 0;
    }
    expect(sms.ram[0x13]).toBe(1);
    expect(respawn).toBe(0);
  });

  it('alte Ereignisse ohne Typ werden zu „spawn“; kaputte Ereignisse werden abgelehnt', () => {
    const demo = createDemoProject();
    demo.levels.forEach((l) => { l.events = l.events.filter((e) => e.type === 'spawn'); }); // alte Projekte kannten nur Gegner-Ereignisse
    const old = JSON.parse(JSON.stringify(demo));
    old.levels.forEach((l: { events: Record<string, unknown>[] }) => l.events.forEach((e) => { delete e.type; }));
    expect(validateProject(old)).toBe('Ungültiges Ereignis');
    const up = upgradeProject(old) as ReturnType<typeof createDemoProject>;
    expect(validateProject(up)).toBeNull();
    expect(up.levels[0].events[0]).toEqual({ pos: 40, type: 'spawn', formationId: 'f-wave' });
    expect(compileProject(up).banks[1]).toEqual(compileProject(demo).banks[1]);
    for (const bad of [{ pos: 1, type: 'boss' }, { pos: 1, type: 'speed' }, { pos: 'x', type: 'checkpoint' }, { pos: 1, type: 'spawn' }]) {
      const p = JSON.parse(JSON.stringify(createDemoProject()));
      p.levels[0].events.push(bad);
      expect(validateProject(p)).toBe('Ungültiges Ereignis');
    }
  });

  it('Lint: Musik-Ereignis mit gelöschtem Song', () => {
    const p = withEvents([{ pos: 0, type: 'spawn', formationId: 'f-1' }, { pos: 50, type: 'music', musicId: 'weg' }]);
    expect(lintProject(p)).toContainEqual({ severity: 'warn', msg: `Level „${p.levels[0].name}“: Musik-Ereignis bei 50 px: Song wurde gelöscht – neu wählen`, ref: { tab: 'levels', id: p.levels[0].id, events: true, pos: 50 } });
  });
});

describe('Gegnerschüsse', () => {
  const POOL = 0x400; // $C400, 16 × 16 Byte
  const active = (sms: SMS) => [...Array(16)].map((_, i) => POOL + i * 16).filter((a) => sms.ram[a] !== 0);
  const s8 = (v: number) => (v << 24) >> 24;
  const s16 = (lo: number, hi: number) => ((lo | (hi << 8)) << 16) >> 16;
  const vel = (sms: SMS, a: number) => [s16(sms.ram[a + 9], sms.ram[a + 10]), s16(sms.ram[a + 11], sms.ram[a + 12])]; // 8.8
  const cam = (sms: SMS) => sms.ram[6] | (sms.ram[7] << 8);
  // Ein Gegner steht fast still mit der Sprite-Mitte bei (x, y) und schießt
  const sitter = (o: 'h' | 'v', x: number, y: number, shot: Partial<EnemyShot>, pos = 0, count = 1) => {
    const p = createTemplateProject(o);
    p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, ...shot };
    const f = p.formations[0];
    Object.assign(f, { count, spacing: 1, points: [{ x, y }, { x: x + 12, y }], speed: 0.05 }); // ~240 Frames fast an derselben Stelle
    p.levels[0].events = [{ pos, type: 'spawn', formationId: f.id }];
    return p;
  };

  it.each([['straight', 2], ['none', 3]] as const)('horizontal, „%s“: stillstehender Gegner auf Spielerhöhe → Leben danach %i', (pattern, lives) => {
    const p = sitter('h', 200, 96, { pattern, interval: 40, speed: 2 });
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let drawn = false, seen = 0;
    for (let f = 0; f < 240; f++) {
      sms.runFrame();
      for (const a of active(sms)) {
        seen++;
        expect(vel(sms, a)).toEqual([-512, 0]); // gerade = gegen die Scrollrichtung, 2 px/F
        const x = sms.ram[a + 2], y = sms.ram[a + 4];
        if ([...Array(64)].some((_, k) => sms.ram[0x100 + k] === y - 1 && sms.ram[0x140 + k * 2] === x)) drawn = true;
      }
    }
    expect(sms.ram[0x1e]).toBe(lives);
    expect(seen > 0).toBe(pattern !== 'none');
    expect(drawn).toBe(pattern !== 'none'); // Schuss steht in der Sprite-Tabelle
  });

  // Gegner schräg (45°) über dem Spieler: „gerade“ fliegt nach unten vorbei, „gezielt“ trifft
  it.each([['straight', 3], ['aimed', 2]] as const)('vertikal, „%s“: Gegner unter 45° → Leben danach ≤ %i', (pattern, lives) => {
    const p = sitter('v', 128 - 100, 168 - 100, { pattern, interval: 40, speed: 2 }); // Spieler-Hitbox-Mitte bei (128, 168)
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let v: number[] = [];
    for (let f = 0; f < 300; f++) { sms.runFrame(); const [a] = active(sms); if (a && !v.length) v = vel(sms, a); }
    expect(v).toEqual(pattern === 'straight' ? [0, 512] : shotVelocity(2, 2));
    if (pattern === 'straight') expect(sms.ram[0x1e]).toBe(3); else expect(sms.ram[0x1e]).toBeLessThanOrEqual(lives);
  });

  // Spieler fliegt in die Mitte, dann erscheint ein Gegner im Winkel d × 22,5° + 5° (Abstand 64) und schießt – also in Richtung d + 8
  const firstShots = (pattern: 'aimed' | 'fan3', d: number) => {
    const th = ((d * 22.5 + 5) * Math.PI) / 180;
    const p = sitter('h', Math.round(136 + 64 * Math.cos(th)), Math.round(96 + 64 * Math.sin(th)), { pattern, interval: 10, speed: 1.5 }, 60);
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 300; f++) {
      sms.buttons = sms.ram[0x82] < 128 ? BTN.right : 0;
      sms.runFrame();
      const a = active(sms);
      if (a.length) return { x: sms.ram[0x82], v: a.map((b) => vel(sms, b)) };
    }
    throw new Error('kein Schuss');
  };
  it('gezielt: alle 16 Richtungen zum Spieler (Richtung aus dx/dy über Oktanten)', () => {
    for (let d = 0; d < 16; d++) {
      const r = firstShots('aimed', d);
      expect(r.x).toBe(128); // Spieler ist schon in der Mitte
      expect([d, r.v]).toEqual([d, [shotVelocity(1.5, (d + 8) & 15)]]);
    }
  });
  it('Fächer: drei Schüsse, Mitte zum Spieler, ±22,5°', () => {
    const r = firstShots('fan3', 15);
    expect(r.v).toEqual([shotVelocity(1.5, 7), shotVelocity(1.5, 6), shotVelocity(1.5, 8)]);
  });

  // Rechenzeit: Kamera mit 0,5 px/F zeigt verlorene Frames (Hauptschleife länger als ein Bild)
  const camAfter = (p: ReturnType<typeof createTemplateProject>, frames: number, buttons: number = BTN.b1) => {
    const sms = new SMS(buildRom(engineBinary(), p, { invincible: true }).rom);
    let max = 0;
    for (let f = 0; f < frames; f++) { sms.buttons = buttons; sms.runFrame(); max = Math.max(max, active(sms).length); }
    return { cam: cam(sms), max };
  };
  // vorher lag die Hauptschleife hier bei höchstens 59 452 von 59 736 Takten je Bild
  it('Rechenzeit: 12 Gegner im Bild ohne Schüsse verlieren keinen Frame (wie vor den Gegnerschüssen)', () => {
    expect(camAfter(sitter('h', 200, 60, { pattern: 'none' }, 0, 12), 300, 0).cam).toBe(camAfter(sitter('h', 200, 60, { pattern: 'none' }), 300, 0).cam);
  });
  it('Rechenzeit: Demo mit schießenden Käfern läuft so schnell wie ohne', () => {
    const p = createDemoProject();
    p.levels = [p.levels[0]];
    const calm = createDemoProject();
    calm.levels = [calm.levels[0]];
    calm.enemyTypes.forEach((t) => { t.shot.pattern = 'none'; });
    const a = camAfter(p, 1200);
    expect(a.max).toBeGreaterThan(0);
    expect(a.cam).toBe(camAfter(calm, 1200).cam);
  });
  it('Pool voll (16 Schüsse): weitere Schüsse entfallen, das Spiel läuft (verlangsamt) weiter', () => {
    const r = camAfter(sitter('h', 200, 60, { pattern: 'fan3', interval: 8, speed: 0.5 }, 0, 12), 300);
    expect(r.max).toBe(16);
    expect(r.cam).toBeGreaterThan(50);
  });

  // ---- Taktmessung (SMS.busy/maxBusy): Arbeit je Spielbild, ohne die Wartezeit im halt ----
  const S = ENGINE_SYMBOLS;
  const FRAME = 59736;
  const MAXBUSY_E0 = 90000; // vor E0 (d733060, 6 Schüsse): H 94 192, V 91 125; nach E0: H 67 286, V 65 647; E1 mit 10 Schüssen: H 85 339, V 82 103
  // [Spielbilder, Hash]: Demo H, Demo V, Schussbahn, Wand, Körpertreffer+Abschuss
  // Neu kalibriert mit E1 (16 Gegner-Slots, 10 Schuss-Slots, Leben und PSG im Hash). Vorher geprüft (Skript gegen Stand 85bd348):
  // alte Projekte nach upgradeProject Bild für Bild gleich in Spieler, Leben, Gegnern, Gegner-/Spielerschüssen, SAT-Inhalt und PSG
  // Neu kalibriert mit der Treffermaske: Byte 15 der Schüsse (früher B_LAST) bleibt jetzt 0; Verhalten gegen 85bd348 erneut Bild für Bild gleich geprüft
  const GOLDEN = [[900, 26802711], [900, 3923879040], [400, 4205206404], [400, 503720365], [200, 1536139417]];
  const count = (sms: SMS, base: number, n: number) => [...Array(n)].filter((_, i) => sms.ram[base - 0xc000 + i * 16] !== 0).length;
  // Spitzenlast der Spielbilder 100..249 (Startschutz und Spawn vorbei, Sitzer noch auf dem Pfad)
  const peak = (p: ReturnType<typeof createTemplateProject>, b1: boolean, pcCycles?: Uint32Array) => {
    const sms = new SMS(buildRom(engineBinary(), p, { invincible: true }).rom);
    let frames = 0; // Spielbilder (halts) ab Bild 100
    for (let f = 0; f < 250; f++) {
      if (f === 100) { sms.maxBusy = 0; sms.pcCycles = pcCycles; sms.onHalt = () => { frames++; }; }
      sms.buttons = b1 ? BTN.b1 : 0;
      sms.runFrame();
    }
    return { max: sms.maxBusy, frames, enemies: count(sms, S.enemies, S.MAXE), shots: count(sms, S.shots, S.MAXPS), bullets: count(sms, S.bullets, S.MAXB) };
  };
  // n Gegner fast still, abseits der Schussbahn (H: über dem Spieler, V: links von ihm); rapid = Spieler-Pool immer voll
  const scene = (o: 'h' | 'v', n: number, shot: Partial<EnemyShot> = { pattern: 'none' }, rapid = true, wide = false) => {
    const p = o === 'h' ? sitter('h', 200, 30, shot, 0, n) : sitter('v', 40, 60, shot, 0, n);
    if (!n) p.levels[0].events = [];
    if (rapid) p.weapons[0].levels[0].fireRate = 1;
    if (wide) p.enemyTypes[0].hitbox = { x: 0, y: 2, w: 248, h: 12 }; // jede Schuss-X überlappt: Paarprüfung läuft immer ganz durch
    return p;
  };

  it('Taktmessung: busy zählt die Arbeit eines Spielbilds (Demo: > 0, passt ins Bild)', () => {
    const p = createDemoProject();
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    for (let f = 0; f < 60; f++) sms.runFrame();
    sms.maxBusy = 0;
    for (let f = 0; f < 300; f++) { sms.buttons = BTN.b1; sms.runFrame(); }
    expect(sms.busy).toBeGreaterThan(5000);
    expect(sms.maxBusy).toBeGreaterThanOrEqual(sms.busy);
    expect(sms.maxBusy).toBeLessThan(FRAME);
  });

  it('Taktmessung: Pause-NMI überschreibt busy nicht, Levelaufbau zählt als loadBusy statt maxBusy', () => {
    // Pause: jedes gemeldete Spielbild hat echte Arbeit (vorher meldete das NMI eine Strecke von ~70 Takten)
    const sms = new SMS(buildRom(engineBinary(), createDemoProject()).rom);
    for (let f = 0; f < 60; f++) sms.runFrame();
    const seen: number[] = [];
    sms.onHalt = () => { if (!sms.loadBusy) seen.push(sms.busy); };
    sms.pause(); for (let f = 0; f < 10; f++) sms.runFrame();
    sms.pause(); for (let f = 0; f < 10; f++) sms.runFrame();
    expect(seen.length).toBeGreaterThanOrEqual(19);
    expect(Math.min(...seen)).toBeGreaterThan(1000);
    // Levelende im Messfenster: Neuaufbau (> 1 Bild) landet in loadBusy, maxBusy misst nur Spielbilder
    const p = createTemplateProject('h');
    p.levels[0].speed = 4;
    const lv = new SMS(buildRom(engineBinary(), p).rom);
    let loads = 0, maxLoad = 0;
    lv.onHalt = () => { if (lv.loadBusy) { loads++; maxLoad = Math.max(maxLoad, lv.loadBusy); } };
    for (let f = 0; f < levelDuration(p.levels[0]).frames + 200; f++) lv.runFrame();
    expect(loads).toBeGreaterThanOrEqual(2); // Init + Neustart nach Levelende
    expect(maxLoad).toBeGreaterThan(FRAME);
    expect(lv.maxBusy).toBeLessThan(FRAME);
  });

  // 12 Gegner + 6 Spielerschüsse sprengen das Bild weiterhin (59 736), aber E0 spart rund 27 000 Takte; die Grenze sichert das ab
  // shortcut: passt erst mit weniger Gegnern/Schüssen ins Bild; das Budget-Modell (E1) sperrt solche Kombinationen
  // shortcut: 12 Gegner + volles Dauerfeuer passt erst mit weniger Gegnern/Schüssen ins Bild; das Budget (upgradeBudget) meldet solche Kombinationen
  it('Rechenzeit: 12 Gegner und Dauerfeuer (10 Schüsse) bleiben unter dem Stand vor E0 (mit nur 6 Schüssen)', () => {
    const r = (['h', 'v'] as const).map((o) => ({ o, ...peak(scene(o, 12), true) }));
    if (process.env.PROFILE) console.log('12 Gegner + Dauerfeuer', r.map((x) => `${x.o} ${x.max}`).join(', '));
    for (const x of r) {
      expect([x.o, x.enemies, x.shots >= S.MAXPS - 1]).toEqual([x.o, 12, true]); // Pool (fast) voll
      expect(x.max).toBeLessThan(MAXBUSY_E0);
    }
  });

  // Verhalten pro Spielbild (nicht pro Emulator-Bild, damit gesparte Takte nichts verschieben): Hash über Spieler, Leben, PSG, SAT und alle Objekt-Pools
  // poke(sms, g): RAM-Eingriff vor Spielbild g (erzwingt seltene Fälle)
  const trace = (p: ReturnType<typeof createDemoProject>, games: number, poke?: (sms: SMS, g: number) => void) => {
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    const areas = [[S.frame, 1], [S.camPos, 2], [S.rot, 3], [S.lives, 1], [S.bulCount, 1], [S.sfxLeft, 2], [S.player, 16], [S.satY, 0xc0], [S.enemies, 0x300]];
    // Zeichen-/Datenzeiger der Schüsse hängen am Datenlayout, nicht am Verhalten
    const skip = (a: number) => a >= S.shots && ((a & 15) === S.B_DEF || (a & 15) === S.B_DEF + 1) && (a < S.shots + 0x100 || a >= S.bullets);
    let g = 0, h = 2166136261;
    sms.onHalt = () => {
      if (g >= games) return;
      for (const [a, n] of areas) for (let i = 0; i < n; i++) if (!skip(a + i)) h = Math.imul(h ^ sms.ram[a - 0xc000 + i], 16777619);
      for (const v of sms.psg.regs) h = Math.imul(h ^ v, 16777619);
      g++;
      sms.buttons = BTN.b1 | [BTN.up, BTN.right, BTN.down, BTN.left][(g >> 5) & 3];
      poke?.(sms, g);
    };
    for (let f = 0; f < games * 2 && g < games; f++) sms.runFrame();
    return [g, h >>> 0];
  };
  // Tödliche Metallwand (Pinsel 6) quer durch die Schussbahn und die Flugbahn des Spielers
  const wall = () => {
    const p = createDemoProject();
    p.levels = [p.levels[0]];
    p.levels[0].events = [];
    for (let c = 9; c < 11; c++) for (let r = 3; r < 9; r++) p.levels[0].map[c * 12 + r] = 6;
    return p;
  };
  // Zwei Gegner, HP 1: vor Spielbild 120 sitzt Slot 0 auf dem Spieler und Slot 1 auf dem ersten Spielerschuss → Körpertreffer und Abschuss im selben Bild
  const pair = () => { const p = sitter('h', 200, 30, { pattern: 'none' }, 0, 2); p.enemyTypes[0].hp = 1; return p; };
  const pokePair = (sms: SMS, g: number) => {
    if (g !== 120) return;
    const r = sms.ram, at = (a: number) => a - 0xc000;
    const shot = [...Array(S.MAXPS)].map((_, i) => at(S.shots) + i * 16).find((a) => r[a]);
    if (shot === undefined) throw new Error('kein Spielerschuss');
    const put = (slot: number, x: number, y: number) => { const e = at(S.enemies) + slot * 16; r[e + S.O_X] = x; r[e + S.O_X + 1] = 0; r[e + S.O_Y] = y; r[e + S.O_Y + 1] = 0; };
    put(0, r[at(S.player) + S.O_X], r[at(S.player) + S.O_Y]);
    put(1, r[shot + S.O_X], r[shot + S.O_Y]);
  };
  it('Körpertreffer und Abschuss eines späteren Slots im selben Bild: Explosions-Ton nach dem Treffer-Ton', () => {
    const p = pair();
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let g = 0, seen = false;
    sms.onHalt = () => {
      g++;
      sms.buttons = BTN.b1;
      if (g === 121) { // Spielbild nach dem Eingriff
        const e = (slot: number) => sms.ram[S.enemies - 0xc000 + slot * 16];
        expect([sms.ram[S.lives - 0xc000], e(0), e(1), sms.ram[S.sfxCh - 0xc000]]).toEqual([2, 2, 3, 3]); // Leben weg, Slot 0 lebt, Slot 1 explodiert, Rauschkanal = Explosion
        seen = true;
      }
      pokePair(sms, g);
    };
    for (let f = 0; f < 200 && !seen; f++) sms.runFrame();
    expect(seen).toBe(true);
  });
  it('Verhalten je Spielbild bleibt gleich (Hash; Stand E1, vorher bildgleich zu E0 geprüft)', () => {
    const demo = (i: number) => { const p = createDemoProject(); p.levels = [p.levels[i]]; return p; };
    const lane = sitter('h', 200, 96, { pattern: 'aimed', interval: 30, speed: 1.5 }, 0, 12); // 12 Gegner in der Schussbahn, HP 2
    lane.enemyTypes[0].hp = 2;
    const got = [trace(demo(0), 900), trace(demo(1), 900), trace(lane, 400), trace(wall(), 400), trace(pair(), 200, pokePair)];
    if (process.env.PROFILE) console.log('GOLDEN', JSON.stringify(got));
    expect(got).toEqual(GOLDEN);
  });

  // ---- Budget-Modell (budget.ts): Residuen gegen Szenen, aus denen die Konstanten NICHT stammen ----
  // Zählt je Spielbild Gegner (Slot belegt), Schüsse, Zusatz-Sprites (Teile laut layoutSprites über der Grundausstattung) und Salven
  const loadOf = (p: ReturnType<typeof createDemoProject>, frames: number, from: number, move: (g: number) => number) => {
    const lay = layoutSprites(p.sprites);
    const parts = (id: string) => Math.max(0, ...(lay.metasprites.get(id) ?? [[]]).map((f) => f.length));
    const enParts = p.enemyTypes.map((t) => parts(t.spriteId)), boom = parts('boom'), shotParts = parts(p.weapons.find((w) => w.id === p.player.weaponId)!.spriteId);
    const bulParts = Math.max(1, ...p.enemyTypes.map((t) => (t.shot && t.shot.pattern !== 'none' ? parts(t.shot.spriteId) : 1)));
    const sms = new SMS(buildRom(engineBinary(), p, { invincible: true }).rom);
    const pc = new Uint32Array(0x10000);
    sms.pcCycles = pc;
    const r = (a: number) => sms.ram[a - 0xc000];
    const out: { busy: number; l: FrameLoad }[] = [];
    let g = 0;
    sms.onHalt = () => {
      if (sms.loadBusy) return;
      const volleys = pc[S.efShoot] / 20; // efShoot beginnt mit ld iy,(nn) = 20 Takte → Anzahl Aufrufe
      pc[S.efShoot] = 0;
      sms.buttons = BTN.b1 | move(++g);
      if (g <= from) return;
      const l: FrameLoad = { enemies: 0, playerShots: 0, enemyShots: 0, extraSprites: Math.max(0, parts(p.player.spriteId) - 2), volleys };
      for (let i = 0; i < S.MAXE; i++) {
        const st = r(S.enemies + i * 16);
        if (st) { l.enemies++; l.extraSprites += Math.max(0, (st === 3 ? boom : enParts[r(S.enemies + i * 16 + S.O_TYPE)]) - 2); }
      }
      for (let i = 0; i < S.MAXPS; i++) if (r(S.shots + i * 16)) { l.playerShots++; l.extraSprites += Math.max(0, shotParts - 1); }
      for (let i = 0; i < S.MAXB; i++) if (r(S.bullets + i * 16)) { l.enemyShots++; l.extraSprites += bulParts - 1; }
      out.push({ busy: sms.busy, l });
    };
    for (let f = 0; f < frames; f++) sms.runFrame();
    return out;
  };
  it('Budget: Stufen grün/gelb/rot und Formel', () => {
    expect([54_000, 54_001, 110_000, 110_001].map(budgetLevel)).toEqual(['green', 'yellow', 'yellow', 'red']);
    expect(frameCost({ enemies: 0, enemyShots: 0, playerShots: 0, extraSprites: 0, volleys: 0 })).toBe(COST.BASIS);
    expect(frameCost({ enemies: 2, enemyShots: 3, playerShots: 4, extraSprites: 5, volleys: 1 }))
      .toBe(COST.BASIS + 2 * COST.EN + 3 * COST.BU + 4 * COST.SH + 8 * COST.PAIR + 5 * COST.XS + COST.VOLLEY);
  });

  // Konstanten stammen aus einer Regression über Vorlage-Szenen (docs/data-format.md §5); hier: unabhängige Szenen, Ist ≤ Modell in jedem Bild
  it('Budget-Modell: gemessene Takte ≤ frameCost in jedem Spielbild unabhängiger Szenen; Benchmarks nie rot', () => {
    const demo1 = () => { const p = createDemoProject(); p.levels = [p.levels[0]]; return p; };
    const scenes: [string, () => ReturnType<typeof createDemoProject>, number, number, (g: number) => number][] = [
      ['Demo-Level 1 mit Musik', demo1, 600, 0, roam],
      ['(1) Kette 4 + 3 Schiffe, Laser', bench1, 330, 30, wiggle],
      ['(2) Ring 12, gezielt', bench2, 400, 150, () => 0],
      ['(2b) Ring 16 (E1)', ring16, 400, 150, () => 0],
      ['(4) Fächer Stufe 2 gegen Kette + Block (E1)', fanScene, 330, 30, wiggle],
      ['(3) 4 Gegner vor Demo-Hintergrund, Laser', bench3, 450, 30, wiggle],
    ];
    const report: string[] = [];
    for (const [name, mk, frames, from, move] of scenes) {
      const p = mk();
      const rows = loadOf(p, frames, from, move);
      const worst = Math.max(...rows.map((x) => x.busy / frameCost(x.l)));
      const top = rows.reduce((a, x) => (x.busy > a.busy ? x : a));
      // Lint-Schätzung (upgradeBudget, ohne Messung) liegt über jeder gemessenen Spitze
      const lint = upgradeBudget(p, p.levels[0]);
      report.push(`${name}: max Ist/Modell ${worst.toFixed(3)}, Spitze ${top.busy} (${budgetLevel(top.busy)}) bei ${JSON.stringify(top.l)}, Modell ${frameCost(top.l)} (${budgetLevel(frameCost(top.l))}), Lint ${lint.cost} (${lint.level})`);
      expect(rows.length).toBeGreaterThan(frames / 2 - from);
      expect([name, worst <= 1]).toEqual([name, true]);
      expect([name, budgetLevel(top.busy)]).not.toEqual([name, 'red']);
      expect([name, lint.cost >= top.busy]).toEqual([name, true]);
      if (name.includes('Ring 16')) expect([top.l.enemies, lint.level]).toEqual([16, 'yellow']);
    }
    if (process.env.PROFILE) console.log(report.join('\n'));
  });

  // nur mit PROFILE=1: Eigenkosten je Routine im schwersten Vorlage-Szenario (12 Gegner, Dauerfeuer, breite Hitbox), Takte pro Bild
  it.skipIf(!process.env.PROFILE)('Profil: Eigenkosten je Routine', () => {
    const pc = new Uint32Array(0x10000);
    const r = peak(scene('h', 12, undefined, true, true), true, pc);
    const names = ['mainLoop', 'waitVblank', 'uploadSat', 'readJoy', 'setScroll', 'doStreaming', 'drawColumn', 'drawRow', 'updateCamera', 'processEvents', 'updatePlayer', 'fireShot',
      'updateShots', 'updateEnemies', 'enemyFire', 'efShoot', 'spawnBullet', 'aimDir', 'typePtr', 'animate', 'curFrame', 'updateBullets', 'bulletStep', 'ovl1', 'enemyBox', 'boxHit', 'collide',
      'playerBox', 'boxScan', 'bulletCollide', 'solidAt', 'bgCollide', 'playerHit', 'checkLevelEnd', 'buildSat', 'drawPool', 'drawEnemy', 'drawMeta', 'soundUpdate', 'musicUpdate', 'sfxUpdate']
      .filter((n) => n in S).sort((a, b) => S[a] - S[b]);
    const self: Record<string, number> = {};
    for (let a = 0x38; a < 0x4000; a++) if (pc[a]) {
      const n = a < S.init ? 'IRQ/NMI' : names.filter((x) => S[x] <= a).pop() ?? 'init';
      self[n] = (self[n] ?? 0) + pc[a] / r.frames;
    }
    console.log('maxBusy', r.max, 'Eigenkosten je Routine (Takte/Bild):', Object.fromEntries(Object.entries(self).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v)])));
  });

  it('Compiler: Typ-Byte 8-9 → Schussdefinition (0 = schießt nicht); alte Projekte ohne Schuss bleiben bytegleich', () => {
    const p = createDemoProject();
    const g = compileProject(p).global;
    const types = (g[0x20] | (g[0x21] << 8)) - 0x8000;
    expect([g[types + 8], g[types + 9]]).toEqual([0, 0]); // Drohne
    const def = (g[types + 16 + 8] | (g[types + 16 + 9] << 8)) - 0x8000; // Käfer: gezielt
    expect([...g.slice(def, def + 2)]).toEqual([2, 90]);
    // Hitbox = sichtbare Pixel (Kugel x 1..6, y 5..10); Start: Gegnermitte − Schussmitte; Zielversatz: Spieler-Hitbox-Mitte (8, 8) − Schuss-Hitbox-Mitte (4, 8)
    expect([...g.slice(def + 4, def + 12)].map(s8)).toEqual([1, 5, 6, 6, 8 - 4, 8 - 8, 4, 0]);
    expect([0, 1].map((k) => s16(g[def + 12 + 8 * 4 + k * 2], g[def + 13 + 8 * 4 + k * 2]))).toEqual([-384, 0]); // Richtung 8 = links, 1,5 px/F

    const old = JSON.parse(JSON.stringify(createDemoProject()));
    old.enemyTypes.forEach((t: Record<string, unknown>) => { delete t.shot; });
    expect(validateProject(old)).toBe('Ungültiger Gegnertyp');
    const up = upgradeProject(old) as ReturnType<typeof createDemoProject>;
    expect(validateProject(up)).toBeNull();
    expect(up.enemyTypes[0].shot).toEqual({ pattern: 'none', interval: 60, spriteId: 'shot', speed: 1.5 });
    const none = createDemoProject();
    none.enemyTypes[1].shot.pattern = 'none';
    expect(compileProject(up).global).toEqual(compileProject(none).global);
    for (const bad of [{ pattern: 'laser', interval: 1, speed: 1, spriteId: '' }, { pattern: 'aimed', interval: 'x', speed: 1, spriteId: '' }, null]) {
      const q = JSON.parse(JSON.stringify(createDemoProject()));
      q.enemyTypes[0].shot = bad;
      expect(validateProject(q)).toBe('Ungültiger Gegnertyp');
    }
  });

  it('Lint: fehlendes Schuss-Sprite ist ein Fehler, das Schuss-Sprite gilt als verwendet', () => {
    const p = createDemoProject();
    const bug = p.enemyTypes[1];
    expect(spriteUsers(p, 'orb')).toEqual([{ label: `Gegnertyp „${bug.name}“ (Schuss)`, ref: { tab: 'objects', id: bug.id } }]);
    bug.shot.spriteId = 'weg';
    expect(lintProject(p)).toContainEqual({ severity: 'error', msg: `Gegnertyp „${bug.name}“: Schuss-Sprite fehlt – neu wählen`, ref: { tab: 'objects', id: bug.id } });
    bug.shot.pattern = 'none';
    expect(lintProject(p).filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('Lint: Gegnerschuss mit dem Sprite des Spielerschusses ist eine Warnung (nur wenn er schießt)', () => {
    const p = createDemoProject();
    const bug = p.enemyTypes[1];
    const warn = { severity: 'warn', msg: `Gegnertyp „${bug.name}“: Schuss sieht aus wie der Spielerschuss – eigenes Sprite wählen`, ref: { tab: 'objects', id: bug.id } };
    bug.shot.spriteId = p.weapons[0].spriteId;
    expect(lintProject(p)).toContainEqual(warn);
    bug.shot.pattern = 'none';
    expect(lintProject(p)).not.toContainEqual(warn);
  });
});

describe('Waffen (E1)', () => {
  type P = ReturnType<typeof createDemoProject>;
  const S = ENGINE_SYMBOLS;
  const at = (a: number) => a - 0xc000;
  const s16 = (lo: number, hi: number) => ((lo | (hi << 8)) << 16) >> 16;
  const shots = (sms: SMS) => [...Array(S.MAXPS)].map((_, i) => at(S.shots) + i * 16).filter((a) => sms.ram[a]);
  const vel = (sms: SMS, a: number) => [s16(sms.ram[a + S.B_VX], sms.ram[a + S.B_VX + 1]), s16(sms.ram[a + S.B_VY], sms.ram[a + S.B_VY + 1])];
  const arm = (p: P, w: Weapon) => { p.weapons.push(w); p.player.weaponId = w.id; return p; };
  const single = (st: Partial<Weapon['levels'][number]>, pierce = false): Weapon =>
    ({ id: 'w-t', name: 'Test', spriteId: 'shot', speed: 6, pierce, levels: [{ fireRate: 40, damage: 1, emitters: [{ ahead: 8, side: 0, dir: 0 }], ...st }] });
  // Gegner (Typ e-1) stehen fast still auf Spielerhöhe (Mitte y = 96) bei den x-Mitten xs
  const lane = (p: P, xs: number[], hp: number) => {
    p.enemyTypes[0].hp = hp;
    Object.assign(p.formations[0], { mode: 'block', count: xs.length, offsets: xs.map((x) => ({ x: x - xs[0], y: 0 })), points: [{ x: xs[0], y: 96 }, { x: xs[0] + 12, y: 96 }], speed: 0.05 });
    p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: p.formations[0].id }];
    return p;
  };
  const run = (p: P, frames: number, buttons: (g: number) => number, each?: (sms: SMS, g: number) => void) => {
    const sms = new SMS(buildRom(engineBinary(), p).rom);
    let g = 0;
    sms.onHalt = () => { g++; each?.(sms, g); sms.buttons = buttons(g); };
    for (let f = 0; f < frames; f++) sms.runFrame();
    return sms;
  };

  it.each(['h', 'v'] as const)('altes Projekt (%s) schießt nach der Migration wie früher: Start am alten Versatz, gleiches Tempo', (o) => {
    const old = JSON.parse(JSON.stringify(createTemplateProject(o)));
    delete old.weapons; delete old.upgrades; delete old.player.weaponId;
    const off = o === 'h' ? { x: 12, y: 0 } : { x: 4, y: -12 };
    Object.assign(old.player, { shotSpriteId: 'shot', shotSpeed: 6, shotHitbox: { x: 0, y: 5, w: 8, h: 6 }, fireRate: 8, shotOffset: off });
    expect(validateProject(old)).toBe('Spielerdefinition fehlt');
    const p = upgradeProject(old) as P;
    expect(validateProject(p)).toBeNull();
    expect(p.upgrades).toEqual({ style: 'off' });
    expect(p.weapons[0]).toMatchObject({ name: 'Standard', speed: 6, pierce: false, hitbox: { x: 0, y: 5, w: 8, h: 6 }, levels: [{ fireRate: 8, damage: 1, emitters: [{ ahead: o === 'h' ? 8 : 12, side: 0, dir: 0 }] }] });
    const seen: number[][] = [];
    run(p, 40, () => BTN.b1, (sms) => {
      const a = shots(sms).find((x) => x === at(S.shots));
      if (a !== undefined && seen.length < 2) seen.push([sms.ram[a + S.O_X], sms.ram[a + S.O_Y], ...vel(sms, a), sms.ram[at(S.player) + S.O_X], sms.ram[at(S.player) + S.O_Y]]);
    });
    const [[x, y, vx, vy, px, py], [x2, y2]] = seen;
    expect([vx, vy]).toEqual(o === 'h' ? [1536, 0] : [0, -1536]);
    // im Bild des Abschusses schon einmal bewegt
    expect([x - vx / 256, y - vy / 256]).toEqual([px + off.x, py + off.y]);
    expect([x2 - x, y2 - y]).toEqual(o === 'h' ? [6, 0] : [0, -6]);
  });

  it.each(['h', 'v'] as const)('Fächer Stufe 2 (%s): eine Salve = 5 Schüsse, Richtungen 14, 15, 0, 1, 2 zur Flugrichtung', (o) => {
    const p = createTemplateProject(o);
    const w = weaponPreset('Fächer', 'w-fan', 'shot');
    w.levels = [w.levels[1]];
    let got: number[][] = [];
    run(arm(p, w), 30, () => BTN.b1, (sms) => { if (!got.length && sms.ram[at(S.shotCount)]) got = shots(sms).map((a) => vel(sms, a)); });
    expect(got).toEqual([14, 15, 0, 1, 2].map((d) => shotVelocity(5, o === 'h' ? d : (d + 12) & 15)));
  });

  // Verlauf (HP, Zustand) des Gegners in Slot 0, bis er explodiert
  const hits = (hp: number, damage: number) => {
    const p = arm(lane(createTemplateProject('h'), [200], hp), single({ damage }));
    const log: [number, number][] = [];
    run(p, 400, () => BTN.b1, (sms) => {
      const e = at(S.enemies), cur: [number, number] = [sms.ram[e + S.O_HP], sms.ram[e]];
      if (cur[1] && (!log.length || log[log.length - 1][0] !== cur[0]) && log[log.length - 1]?.[1] !== 3) log.push(cur);
    });
    return log;
  };
  it('Schaden 2 bei HP 5: Abschuss beim 3. Treffer; HP 1 mit Schaden 3: Abschuss ohne Unterlauf', () => {
    expect(hits(5, 2)).toEqual([[5, 2], [3, 2], [1, 2], [0, 3]]);
    expect(hits(1, 3)).toEqual([[1, 2], [0, 3]]);
  });

  it.each([[true, [9, 9]], [false, [9, 10]]] as const)('Durchschlag=%s: ein Schuss gegen 2 Gegner hintereinander → HP danach %j', (pierce, want) => {
    const p = arm(lane(createTemplateProject('h'), [140, 190], 10), single({ fireRate: 255 }, pierce));
    const sms = run(p, 130, (g) => (g === 60 ? BTN.b1 : 0)); // genau ein Schuss
    expect([0, 1].map((i) => sms.ram[at(S.enemies) + i * 16 + S.O_HP])).toEqual(want);
  });

  it('Durchschlag: zwei überlappende Gegner, langsamer Schuss → jeder genau einmal getroffen (Treffermaske)', () => {
    const p = arm(lane(createTemplateProject('h'), [190, 196], 10), { ...single({ fireRate: 255 }, true), speed: 1 });
    const sms = run(p, 300, (g) => (g === 60 ? BTN.b1 : 0));
    expect([0, 1].map((i) => sms.ram[at(S.enemies) + i * 16 + S.O_HP])).toEqual([9, 9]);
  });

  it('Durchschlag: neuer Gegner im Slot eines getroffenen ist wieder treffbar', () => {
    const p = createTemplateProject('h');
    const sit = (id: string, x: number, hp: number) => ({ id, name: id, enemyTypeId: id === 'a' ? 'e-1' : 'e-2', speed: 0.05, mode: 'chain' as const, count: 1, spacing: 1, offsets: [], points: [{ x, y: 96 }, { x: x + 12, y: 96 }] });
    p.enemyTypes.push({ ...p.enemyTypes[0], id: 'e-2', name: 'Zäh', hp: 10 });
    p.enemyTypes[0].hp = 1;
    p.formations = [sit('a', 100, 1), sit('b', 230, 10)];
    p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'a' }, { pos: 75, type: 'spawn', formationId: 'b' }]; // b kommt in Slot 0, nachdem a explodiert ist
    arm(p, { ...single({ fireRate: 255 }, true), speed: 1 });
    let reused = false;
    const sms = run(p, 400, (g) => (g === 60 ? BTN.b1 : 0), (m) => { if (m.ram[at(S.enemies) + S.O_TYPE] === 1 && m.ram[at(S.enemies)] === 2) reused = true; });
    expect(reused).toBe(true);
    expect(sms.ram[at(S.enemies) + S.O_HP]).toBe(9);
  });

  it('Import: Stufe ohne Austritte und Tempo 0 werden abgelehnt; die Engine feuert bei 0 Austritten nicht', () => {
    const p = createTemplateProject('h');
    p.weapons[0].levels[0].emitters = [];
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toBe('Ungültige Waffe');
    const sms = run(p, 60, () => BTN.b1);
    expect(sms.ram[at(S.shotCount)]).toBe(0);
    const q = createTemplateProject('h');
    q.weapons[0].speed = 0;
    expect(validateProject(JSON.parse(JSON.stringify(q)))).toBe('Ungültige Waffe');
  });

  it('Dauerfeuer mit 5er-Fächer: shotCount = aktive Schüsse, höchstens 10', () => {
    const p = createTemplateProject('h');
    const w = weaponPreset('Fächer', 'w-fan', 'shot');
    w.levels = [{ ...w.levels[2], fireRate: 1 }];
    let max = 0;
    run(arm(p, w), 120, () => BTN.b1, (sms) => {
      const n = sms.ram[at(S.shotCount)];
      expect(n).toBe(shots(sms).length);
      max = Math.max(max, n);
    });
    expect(max).toBe(S.MAXPS);
  });

  it('16 Gegner gleichzeitig (Ring): laufen, nie mehr als halbes Tempo', () => {
    const p = createTemplateProject('h');
    const ring = [...Array(24 * 4 + 1)].map((_, i) => ({ x: Math.round(128 + 56 * Math.cos(Math.PI * i / 12)), y: Math.round(96 + 56 * Math.sin(Math.PI * i / 12)) }));
    p.formations = [{ id: 'ring', name: 'Ring', enemyTypeId: 'e-1', speed: 3, mode: 'chain', count: 16, spacing: 7, offsets: [], points: ring }];
    p.enemyTypes[0].hp = 50;
    p.levels[0].events = [{ pos: 0, type: 'spawn', formationId: 'ring' }];
    let max = 0, games = 0;
    const sms = new SMS(buildRom(engineBinary(), p, { invincible: true }).rom);
    sms.onHalt = () => { games++; sms.buttons = BTN.b1; max = Math.max(max, [...Array(S.MAXE)].filter((_, i) => sms.ram[at(S.enemies) + i * 16] === 2).length); };
    for (let f = 0; f < 400; f++) sms.runFrame();
    expect(max).toBe(16);
    expect(sms.maxBusy).toBeLessThanOrEqual(BUDGET_YELLOW);
    expect(games).toBeGreaterThan(200); // höchstens halbes Tempo
    expect(upgradeBudget(p, p.levels[0]).level).toBe('yellow');
  });

  it('Compiler: Version 4, Upgrade-Block über Global 06, Waffenstufe wie Schussdefinition plus Austritte H und V', () => {
    const p = createTemplateProject('h');
    const w = arm(p, weaponPreset('Fächer', 'w-fan', 'shot')).weapons[1];
    const g = compileProject(p).global;
    const word = (a: number) => g[a] | (g[a + 1] << 8);
    expect(g[4]).toBe(4);
    const u = word(6) - 0x8000;
    expect([...g.slice(u, u + 4)]).toEqual([0, 0, 1, 2]); // Stil aus, Flags, Startwaffe 1, 2 Waffen
    const wp = word(word(u + 4) - 0x8000 + 2) - 0x8000; // Waffe 1
    expect(g[wp]).toBe(3);
    const lv = word(wp + 3) - 0x8000; // Stufe 2
    expect([g[lv], g[lv + 1], g[lv + 8], g[lv + 9]]).toEqual([1, 0, w.levels[1].fireRate, 5]);
    expect([...g.slice(lv + 4, lv + 8)]).toEqual([0, 7, 8, 2]); // Hitbox = sichtbare Pixel des Schuss-Sprites
    const em = (o: number, i: number) => { const a = lv + 10 + o * 30 + i * 6; return [s16(g[a + 2], g[a + 3]), s16(g[a + 4], g[a + 5])]; };
    expect([0, 1, 2, 3, 4].map((i) => em(0, i))).toEqual([14, 15, 0, 1, 2].map((d) => shotVelocity(5, d)));
    expect([0, 1, 2, 3, 4].map((i) => em(1, i))).toEqual([10, 11, 12, 13, 14].map((d) => shotVelocity(5, d)));
  });

  it('Lint: Salve > 10, tote Waffenverweise, fehlendes Waffen-Sprite; Waffen-Sprite gilt als verwendet', () => {
    const p = createDemoProject();
    const w = arm(p, weaponPreset('Fächer', 'w-fan', 'shot')).weapons[1];
    expect(spriteUsers(p, 'shot').map((u) => u.label)).toEqual(['Waffe „Standard“', 'Waffe „Fächer“']);
    expect(weaponUsers(p, w.id)).toEqual([{ label: 'Spieler (Startwaffe)', ref: { tab: 'objects' } }]);
    w.levels[2].emitters = [...Array(11)].map((_, i) => ({ ahead: 8, side: i - 5, dir: 0 }));
    w.spriteId = 'weg';
    const d = lintProject(p);
    const ref = { tab: 'upgrades', id: w.id };
    expect(d).toContainEqual({ severity: 'error', msg: 'Waffe „Fächer“, Stufe 3: Salve aus 11 Schüssen, höchstens 10 – Austritte entfernen', ref });
    expect(d).toContainEqual({ severity: 'error', msg: 'Waffe „Fächer“: Sprite fehlt – neu wählen', ref });
    p.player.weaponId = 'weg';
    expect(lintProject(p)).toContainEqual({ severity: 'error', msg: 'Spieler: Startwaffe fehlt – neu wählen', ref: { tab: 'objects' } });
  });

  it('Lint: Rechenzeit – Sperre erst über PLAN.BLOCK, „stark“ über 110 000, „kurz“ über einem Bild, lange Strecken eigene Warnung; Rat nach Ursache', () => {
    const ringP = (pattern: EnemyShot['pattern'], laps: number) => {
      const p = createTemplateProject('h');
      const ring = [...Array(24 * laps + 1)].map((_, i) => ({ x: Math.round(128 + 56 * Math.cos(Math.PI * i / 12)), y: Math.round(96 + 56 * Math.sin(Math.PI * i / 12)) }));
      p.formations = [{ id: 'ring', name: 'Ring', enemyTypeId: 'e-1', speed: 3, mode: 'chain', count: 16, spacing: 7, offsets: [], points: ring }];
      p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern, interval: 60 };
      p.enemyTypes[0].hp = 50; // zäh: die Planungsschätzung rechnet sonst mit Abschüssen
      p.levels[0].events = [{ pos: 20, type: 'spawn', formationId: 'ring' }];
      return p;
    };
    // senkrechte Wand aus 16 Fächer-Schützen: alle feuern im selben Bild
    const wallP = () => {
      const p = createTemplateProject('h');
      p.enemyTypes[0].hp = 50;
      p.enemyTypes[0].shot = { ...p.enemyTypes[0].shot, pattern: 'fan3', interval: 30 };
      p.formations = [{ id: 'w', name: 'Wand', enemyTypeId: 'e-1', speed: 0.5, mode: 'block', count: 16, spacing: 0, offsets: [...Array(16)].map((_, i) => ({ x: 0, y: i * 12 - 90 })), points: [{ x: 264, y: 96 }, { x: -40, y: 96 }] }];
      p.levels[0].events = [{ pos: 20, type: 'spawn', formationId: 'w' }];
      return p;
    };
    const budgetMsgs = (p: P) => lintProject(p).filter((x) => /Rechenzeit|verlangsam/.test(x.msg));
    const ev = { tab: 'levels', id: 'lvl-1', events: true, pos: 20 };
    expect(budgetMsgs(wallP())[0]).toEqual({ severity: 'error', msg: 'Level „Level 1“: bei 20 px zu viel Rechenzeit, das Spiel kann bis auf ein Drittel Tempo fallen – Gegner seltener schießen lassen (längere Feuerpause) oder weniger Schützen', ref: ev });
    expect(budgetMsgs(ringP('aimed', 2))).toEqual([{ severity: 'warn', msg: 'Level „Level 1“: kann bei 20 px stark verlangsamen (bis Drittel-Tempo) – Gegnerwellen entzerren oder „Warten“ einfügen', ref: ev }]);
    expect(budgetMsgs(ringP('none', 2))).toEqual([{ severity: 'warn', msg: 'Level „Level 1“: kann bei 20 px kurz verlangsamen – nur ändern, wenn es stört: Gegnerwellen entzerren oder „Warten“ einfügen', ref: ev }]);
    const long = budgetMsgs(ringP('none', 8));
    expect(long).toHaveLength(2);
    expect(long[1]).toMatchObject({ severity: 'warn', msg: expect.stringMatching(/^Level „Level 1“: kann ab 20 px rund \d+ s am Stück verlangsamen/), ref: ev });
    // höhere Stufe der Startwaffe rot: nur Warnung, Sprung öffnet die Stufe
    const p = ringP('aimed', 2);
    p.sprites.push({ id: 'big', name: 'Breit', width: 32, height: 16, frames: [new Array(512).fill(6)], frameDelay: 8 });
    const w = weaponPreset('Fächer', 'w-fan', 'big');
    w.levels = [w.levels[0], { ...w.levels[2], fireRate: 1, emitters: [...Array(10)].map((_, i) => ({ ahead: 8, side: i - 5, dir: (i + 12) & 15 })) }];
    arm(p, w);
    const high = lintProject(p).find((d) => d.msg.startsWith('Waffe „Fächer“, Stufe 2'));
    expect(high).toMatchObject({ severity: 'warn', ref: { tab: 'upgrades', id: 'w-fan', stage: 1 } });
    // Modell: grün bis 54 000
    expect(upgradeBudget(createTemplateProject('h'), createTemplateProject('h').levels[0]).cost).toBeLessThanOrEqual(BUDGET_GREEN);
  });
});
