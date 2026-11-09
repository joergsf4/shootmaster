# Shootmaster – SMS Shmup Maker

Ein webbasierter Editor für **Shoot 'em Ups auf dem Sega Master System**. Grafik, Gegnerwellen, Level und Sound baust du im Browser. Am Ende lädst du eine echte `.sms`-ROM herunter, die in Emulatoren und auf Original-Hardware (z. B. Everdrive) läuft.

![Level-Editor](docs/img/level-editor.png)

## Funktionen

- **Level-Editor:** Level scrollen horizontal oder vertikal. Du malst sie mit Pinsel, Rechteck, Füllen und Pipette aus 16×16-Metatiles. Gegnerwellen setzt du als Marker entlang der Scrollstrecke.
- **Formationen:** Du zeichnest die Flugbahn per Klick. Gegner fliegen als Kette hintereinander oder als starrer Block, zum Beispiel in V-Form. Dazu gibt es Vorlagen, Spiegeln, eine Vorschau mit Zeitleiste und eine Warnung bei zu vielen Sprites pro Bildzeile.
- **Sprites und Tiles:** Pixel-Editor, Animationen und Metatiles mit Spiegelung, beschränkt auf die 64 Hardware-Farben der Konsole.
- **Spieler und Gegner:** Tempo, Schüsse, Leben, Lebenspunkte der Gegner und Trefferzonen (Hitboxen).
- **Sound:** Musik in einem Noten-Raster (Piano-Roll) mit 3 Tonkanälen und Rauschen, dazu Soundeffekte für Schuss, Explosion und Treffer. Abgespielt wird über den eingebauten Soundchip-Emulator, also so, wie es im Spiel klingt.
- **Spielen im Browser:** Der eingebaute Master-System-Emulator läuft mit Bild und Ton.
- **Hardware-Grenzen immer sichtbar:** Anzeigen für den Grafikspeicher (256 Hintergrund-Tiles, 192 Sprite-Tiles), die ROM-Größe und die Sprites pro Bildzeile.
- **Tutorial:** Eine geführte Tour durch alle Werkzeuge, die beim ersten Start automatisch erscheint.
- Automatisches Speichern im Browser, Rückgängig/Wiederholen, Projekt-Export als JSON. Ein Demo-Projekt ist mitgeliefert.

| Formationen | Spielen | Musik |
|---|---|---|
| ![Formationen](docs/img/formationen.png) | ![Spielen](docs/img/spielen.png) | ![Musik](docs/img/musik.png) |

## Schnellstart

Voraussetzungen: Node.js 22 und pnpm 9.

```sh
pnpm install
pnpm dev            # Editor unter http://localhost:5173
pnpm test           # Tests: Hardware-Formate, Pfade, ROM, Engine im Emulator, Sound
pnpm build:engine   # Engine neu assemblieren (nur nach Änderungen an engine/src)
```

Steuerung im Spiel: Pfeiltasten oder WASD zum Bewegen, Z, Y oder Leertaste zum Feuern, P für Pause, Esc zum Schließen. Gamepads werden ebenfalls unterstützt.

## Aufbau

| Ordner | Inhalt |
|---|---|
| [engine/](engine/) | Z80-Engine in Assembler (Scrolling, Gegner, Kollision, Sound-Treiber). Gebaut wird sie mit dem JS-Assembler `z80-asm`, dafür sind weder Docker noch SDCC nötig. |
| [packages/sms-core/](packages/sms-core/) | Projektmodell, Hardware-Formate, Pfad-Backen, Compiler, ROM-Linker, Demo-Projekt |
| [packages/sms-emu/](packages/sms-emu/) | Master-System-Emulator: Z80, Grafikchip (VDP Mode 4), Soundchip (PSG SN76489), Mapper, Joypad |
| [apps/editor/](apps/editor/) | Der Editor (React + Vite) |
| [tools/](tools/) | Headless-Screenshots aus dem ROM und UI-Screenshots über ein lokales Edge/Chrome |
| [docs/](docs/) | [Projektplan](docs/PLAN.md), [Datenformat Engine ↔ Editor](docs/data-format.md), [Tickets](docs/tickets/README.md) |

So entsteht die ROM: Die Engine ist fertig assembliert und belegt Bank 0. Der Editor kompiliert nur die Projektdaten in weitere 16-KB-Banks und schreibt Header und Prüfsumme („TMR SEGA“). Im Browser wird also nichts übersetzt.

## Stand und Grenzen

- Pro Level gibt es bis zu 12 Gegner, 6 Spielerschüsse und 64 Hardware-Sprites. Liegen mehr als 8 Sprites in einer Bildzeile, flackern sie, statt zu verschwinden.
- Es fehlt noch: Gegnerschüsse, Anzeige von Punkten und Leben, Kollision mit dem Hintergrund, Power-ups, Bosse, Titelbild und der Import von Musik oder PNG-Grafiken. Siehe [Tickets](docs/tickets/README.md).
- Getestet ist die ROM bisher mit dem eingebauten Emulator. Ein Test auf echter Hardware steht noch aus.

## Lizenz

[MIT](LICENSE)
