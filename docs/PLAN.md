# SMS Shoot 'em Up Maker – Projektplan

## Context
Ziel ist ein **webbasierter Editor**, mit dem man ohne Programmierkenntnisse ein Shoot 'em Up für das **Sega Master System** baut und am Ende eine lauffähige `.sms`-ROM herunterlädt. Kernbausteine laut Anforderung: Tile-Editor (Hintergrund), Sprite-Editor (Spieler + Gegner), Formations-Editor mit Keyframes, Level-Editor (horizontal oder vertikal) mit Pinsel auf einem langen Level-Streifen.

Tickets: siehe [tickets/README.md](tickets/README.md) · Datenvertrag Engine ↔ Editor: [data-format.md](data-format.md)

---

## 1. Hardware-Rahmen (bestimmt das ganze Design)

| Ressource | Grenze | Konsequenz für den Editor |
|---|---|---|
| Auflösung | 256×192, Tiles 8×8, 4bpp | Alle Editoren arbeiten im 8×8-Raster |
| Farben | 64-Farben-Masterpalette (2 Bit/Kanal), **2 Paletten à 16** (BG + Sprite) | Paletten-Editor erzwingt Hardware-Farben; Farbe 0 der Sprite-Palette = transparent |
| VRAM | 16 KB → ca. **448 Tiles** gesamt (BG + Sprites + HUD-Font) | **Tile-Budget-Anzeige** projektweit, Ampel |
| Name Table | 32×28 Einträge, Tile kann H/V-Flip, Palette, Priorität | BG-Tiles können gespiegelt werden (Dedup!) |
| Sprites | 64 HW-Sprites, **max. 8 pro Scanline**, 8×8 oder 8×16 (global), **kein Flip** | Metasprites, Scanline-Warnung, Flip-Kopien kosten Tiles |
| Scrolling | Hardware-Scroll H und V; Linkskante bei H-Scroll maskieren; HUD-Zeilen fixierbar | Level-Orientierung pro Level, nur eine Achse |
| CPU/RAM | Z80 3,58 MHz, 8 KB RAM | Pfade als vorgebackene Delta-Tabellen, keine Laufzeit-Mathe |
| ROM | 32 KB ohne Mapper, mit Sega-Mapper bis 512 KB (16-KB-Banks) | Sega-Mapper als Standard, Daten in Banks |
| Header | „TMR SEGA“ @ 0x7FF0 + Checksumme + Region | Export-BIOS prüft Checksumme → muss korrekt sein |
| Sound | SN76489 PSG (3 Rechteck + Rauschen) | Sound als späteres Epic |

## 2. Architektur-Empfehlung

**Grundidee: vorkompilierte Engine + datengetriebene ROM.** Die Spiel-Engine wird einmal offline (Z80) gebaut. Der Web-Editor kompiliert *nichts*, sondern erzeugt nur Daten-Banks, hängt sie an das Engine-Binary an, patcht eine Zeigertabelle an fester Adresse und berechnet Header/Checksumme. Das ist robust, schnell und braucht keinen Compiler im Browser.

```
sms-shoo/
├─ engine/              Z80-Engine: C (devkitSMS/SDCC + SMSlib) + ASM für Hot-Loops
│  ├─ src/              Main-Loop, Scroller, Sprite-Mux, Gegner-VM, Kollision
│  ├─ Makefile + Dockerfile   reproduzierbarer Toolchain-Build
│  └─ dist/engine.sms + layout.json  (Adressen der Datentabelle, Formatversion)
├─ packages/sms-core/   reines TypeScript, ohne UI, voll unit-getestet
│  ├─ hw/               Palette, Tile-Encoding (planar 4bpp), Name-Table-Wort
│  ├─ compile/          Projekt-JSON → Binärdaten (Tiles, Metatiles, Level, Pfade)
│  ├─ rom/              Banking, Zeigertabelle, Header, Checksumme
│  └─ validate/         Budget-/Scanline-/Größen-Prüfungen
└─ apps/editor/         Vite + React + TypeScript, Zustand + Immer (Undo/Redo)
   ├─ editors/          Palette, Tiles, Metatiles, Sprites, Formationen, Level
   ├─ canvas/           gemeinsame Pixel-Canvas-Komponenten (Zoom, Grid, Tools)
   └─ emulator/         eingebetteter SMS-Emulator für „Play“
```

- **Datenmodell:** Ein Projekt = ein JSON-Dokument mit `formatVersion`; Speicherung in IndexedDB, Export/Import als `.json`/`.zip`. Migrationen pro Formatversion.
- **Engine ↔ Editor-Vertrag:** `layout.json` + versioniertes Binärformat (in `docs/data-format.md`). Wichtigstes Architektur-Artefakt – früh festlegen.
- **Pfade:** Im Editor Splines, beim Export zu Frame-Deltas (dx,dy als int8, RLE-komprimiert) gebacken. Die Gegner-Logik in der Engine ist eine kleine **Byte-Code-VM** (Befehle: MOVE_PATH, WAIT, SHOOT, SET_ANIM, SET_SPEED, END).
- **Level:** auf **Metatiles 16×16 (2×2 Tiles)** gemalt → Kompression ×4 und schnelles Streaming (eine Spalte/Zeile pro Scroll-Schritt im VBlank).
- **Alternativen bewusst verworfen:** Assembler/Compiler im Browser (WASM) – höherer Aufwand, kein Mehrwert für Nutzer.

## 3. UX-Konzept Formations-Editor (Keyframe-Animator)

Ziel: so einfach wie „Pfad zeichnen, Play drücken“, ohne Frame-Zahlen tippen zu müssen.

1. **Bühne** = 256×192 Screen in Originalgröße ×3, mit **Off-Screen-Rand** (±64 px, ausgegraut) für Ein-/Ausflug.
2. **Pfad-Werkzeug:** Klicken setzt Wegpunkte, Kurve entsteht automatisch (Catmull-Rom); Griffe ziehbar; Rechtsklick → Punkt zu „Ecke“ oder „Warten n Frames“. Geschwindigkeit pro Segment per Ziehen an einem Tempo-Balken (langsam ↔ schnell) statt Zahleneingabe.
3. **Verband statt Einzelgegner:** Pfad wird einem Verband zugeordnet, zwei Modi:
   - **Kette** – N Gegner folgen demselben Pfad mit Abstand X Frames (klassische Schlange).
   - **Block** – starre Formation (V, Reihe, Raute aus Presets oder frei auf Raster gesetzt) bewegt sich gemeinsam.
4. **Zeitleiste** unten: eine Spur pro Gegner, Ereignis-Keyframes als Rauten (Schuss, Animation wechseln, Tempo). Ziehen verschiebt, Alt-Ziehen kopiert auf alle Spuren.
5. **Vorschau:** Play/Pause/Loop, Scrubbing, 0,25×-Zeitlupe, **Onion-Skin** (Geisterbilder alle n Frames), optional Spieler-Dummy.
6. **Helfer:** Spiegeln X/Y, Presets (Sinuswelle, Sturzflug, Kreis, Zickzack, Von-links-rein-rechts-raus), Duplizieren.
7. **Live-Warnungen:** max. Sprites pro Scanline über die gesamte Animation (Heatmap am Bühnenrand), Gesamtzahl gleichzeitiger Sprites.
8. **Platzierung im Level:** Formationen sind Bibliothekselemente; im Level-Editor werden sie als **Trigger-Marker** am Scroll-Streifen abgelegt und als halbtransparente Pfad-Overlays über dem Level angezeigt.

## 4. Level-Editor
- Beim Anlegen: **Orientierung horizontal/vertikal**, Länge in Screens, Scrollgeschwindigkeit.
- Länglicher Streifen mit Zoom/Pan, Minimap, Kamera-Rahmen (zeigt sichtbaren 256×192-Ausschnitt).
- Werkzeuge: Pinsel (Metatile oder Mehrfach-Stempel aus Auswahl), Radierer, Rechteck, Füllen, Pipette, Kopieren/Einfügen, Muster-Wiederholung.
- Ebenen: **Grafik**, **Kollision/Attribute** (fest, tödlich, Priorität „vor Sprites“), **Ereignisse** (Formation-Trigger, Tempo-Wechsel, Checkpoint, Boss, Levelende).
- Vorschau: „ab hier abspielen“ (Emulator startet am Kamerapunkt).

## 5. Schwachstellen & fehlende Komponenten (mit Vorschlag)

| # | Problem / Lücke | Vorschlag |
|---|---|---|
| 1 | **Tile-Budget (~448)** wird schnell überschritten (Level + Sprites + Font) | Globale Budget-Leiste; BG-Dedup inkl. Flip-Erkennung; VRAM-Plan pro Level (Tilesets pro Level nachladen) |
| 2 | **8 Sprites/Scanline** → Gegner verschwinden | Sprite-Multiplexing/Flicker-Rotation in der Engine; Scanline-Analyse im Formations- und Sprite-Editor |
| 3 | **Sprites können nicht gespiegelt werden** | Editor erzeugt gespiegelte Frames automatisch und rechnet sie ins Budget |
| 4 | Gegner > 8×16 brauchen mehrere HW-Sprites | **Metasprite-Editor** (Komposition aus HW-Sprites) |
| 5 | **Nicht erwähnt: Schüsse, Kollision, Hitboxen** | Hitbox pro Sprite; Waffen-/Projektil-Editor (Spieler-Schuss, Gegnerschuss: gezielt/gerade/Fächer) |
| 6 | **Nicht erwähnt: Spielfluss** | Titelbild, HUD (Score, Leben), Game Over, Continue, Level-Reihenfolge |
| 7 | **Nicht erwähnt: Power-ups, Bosse** | Power-up-Typen; Boss als Sonderformation mit HP, Phasen, Musterschleife |
| 8 | **Sound fehlt** | Phase 1: feste SFX-Presets; Phase 2: PSG-SFX-Editor; Musik per Import (VGM → PSGlib), kein eigener Tracker im MVP |
| 9 | Kein Test-Kreislauf | **Eingebetteter Emulator** + „Play from here“; ROM-Download für echte Hardware/Everdrive |
| 10 | Grafiken extern malen | **PNG-Import** mit Quantisierung auf SMS-Palette, Zerlegung in Tiles, Dedup |
| 11 | Paletten-Grenzen | Paletten-Editor nur mit 64 HW-Farben, Warnung bei Tile mit Farben außerhalb |
| 12 | Datenverlust | Autosave IndexedDB, Projekt-Export, Undo/Redo überall |
| 13 | Engine-Format ändert sich | Versionierter Datenvertrag, Migrations-Tests |
| 14 | Performance (Z80) | Fester Objekt-Pool (z. B. 16 Gegner, 24 Gegner-Schüsse, 6 Spielerschüsse); Editor zeigt Limits |
| 15 | PAL/NTSC (50/60 Hz) | Region-Erkennung in Engine, Geschwindigkeiten in Frames ausgehend von 60 Hz; Hinweis im Export |
| 16 | **Lizenzen** (Emulator, devkitSMS, SMSlib, PSGlib) | Lizenz-Check vor Wahl; GPL-Emulator ggf. nur als getrenntes Modul |
| 17 | Parallax (wünschenswert bei horizontal) | Optional später: Raster-Splits via Line-Interrupt (Bänder mit eigener H-Scroll-Geschwindigkeit) |
| 18 | Game Gear als Ziel | Später möglich (gleiche CPU/VDP, 160×144, 12-Bit-Farben) – Datenmodell darauf nicht verbauen |

## 6. Meilensteine
- **M0 – Fundament & Durchstich (kritisch!):** Monorepo, Engine-Toolchain, Datenvertrag, ROM-Builder, Emulator-Einbettung. *Exit:* Ein im Browser aus JSON erzeugtes ROM scrollt ein Testlevel und zeigt ein steuerbares Schiff.
- **M1 – Grafik:** Palette, Tile-, Metatile-, Sprite-/Metasprite-Editor, PNG-Import.
- **M2 – Level:** Level-Editor mit Pinsel, Ebenen, Streaming in der Engine.
- **M3 – Gegner:** Formations-Editor, Pfad-Backen, Gegner-VM, Trigger.
- **M4 – Gameplay:** Schüsse, Kollision, HUD, Spielfluss, Power-ups, Boss.
- **M5 – Polish:** Sound, Titelbild, Validierungs-Dashboard, Onboarding/Beispielprojekt.
