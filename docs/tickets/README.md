# Ticket-Board – SMS Shoot 'em Up Maker

Größen: S ≈ 1–2 Tage · M ≈ 3–5 Tage · L ≈ 1–2 Wochen · XL > 2 Wochen

**Stand 10.11.2026:** Gegnerschüsse, Level-Ereignistypen (Tempo, Musik, Warten, Checkpoint), „Ab hier spielen“, Problem-Panel und Vorlagen fertig.

**Stand 09.11.2026:** Durchstich M0 erreicht – Editor erzeugt spielbare ROMs (horizontal + vertikal).

Kritischer Pfad: SMS-001 → 002 → 003 → 005 → 008 (Durchstich M0) → 026 → 036/037

## Epic A – Fundament (M0)

| ID | Titel | Größe | Abhängigkeiten | Status |
|---|---|---|---|---|
| [SMS-001](SMS-001-monorepo-setup.md) | Monorepo-Setup | S | – | Teilweise – kein CI/ESLint |
| [SMS-002](SMS-002-engine-toolchain.md) | Engine-Toolchain (devkitSMS/SDCC) | M | [001](SMS-001-monorepo-setup.md) | Erledigt (v0) |
| [SMS-003](SMS-003-datenvertrag-v1.md) | Datenvertrag v1 (Binärformat Engine ↔ Editor) | M | [002](SMS-002-engine-toolchain.md) | Erledigt (v0) |
| [SMS-004](SMS-004-sms-core-hw-primitive.md) | sms-core: Hardware-Primitive | M | [001](SMS-001-monorepo-setup.md) | Erledigt (v0) |
| [SMS-005](SMS-005-rom-builder.md) | ROM-Builder | M | [003](SMS-003-datenvertrag-v1.md), [004](SMS-004-sms-core-hw-primitive.md) | Erledigt (v0) |
| [SMS-006](SMS-006-emulator-einbettung.md) | Emulator-Einbettung | L | [001](SMS-001-monorepo-setup.md) | Erledigt (v0) |
| [SMS-007](SMS-007-projektmodell-persistenz.md) | Projektmodell & Persistenz | M | [001](SMS-001-monorepo-setup.md) | Teilweise – localStorage statt IndexedDB |
| [SMS-008](SMS-008-engine-durchstich.md) | Engine-Durchstich (Vertical Slice) | L | [002](SMS-002-engine-toolchain.md), [003](SMS-003-datenvertrag-v1.md), [005](SMS-005-rom-builder.md), [006](SMS-006-emulator-einbettung.md) | Erledigt (v0) |

## Epic B – Grafik-Editoren (M1)

| ID | Titel | Größe | Abhängigkeiten | Status |
|---|---|---|---|---|
| [SMS-010](SMS-010-paletten-editor.md) | Paletten-Editor | S | [004](SMS-004-sms-core-hw-primitive.md), [007](SMS-007-projektmodell-persistenz.md) | Erledigt (v0) |
| [SMS-011](SMS-011-pixel-canvas.md) | Pixel-Canvas-Komponente | M | [001](SMS-001-monorepo-setup.md) | Erledigt (v0) |
| [SMS-012](SMS-012-tile-editor.md) | Tile-Editor (Hintergrund) | M | [010](SMS-010-paletten-editor.md), [011](SMS-011-pixel-canvas.md) | Erledigt (v0) |
| [SMS-013](SMS-013-metatile-editor.md) | Metatile-Editor | M | [012](SMS-012-tile-editor.md) | Teilweise – Kollision nur „tödlich“, kein „fest“ |
| [SMS-014](SMS-014-tile-budget-dedup.md) | Tile-Budget & Deduplizierung | M | [012](SMS-012-tile-editor.md), [015](SMS-015-sprite-editor.md) | Teilweise – Dedup inkl. Spiegeln, kein Budget je Level |
| [SMS-015](SMS-015-sprite-editor.md) | Sprite-Editor | M | [010](SMS-010-paletten-editor.md), [011](SMS-011-pixel-canvas.md) | Erledigt (v0) |
| [SMS-016](SMS-016-metasprite-komposition.md) | Metasprite-Komposition | L | [015](SMS-015-sprite-editor.md) | Teilweise – Zerlegung automatisch, kein Auto-Spiegeln |
| [SMS-017](SMS-017-objekttypen.md) | Objekttypen (Spieler, Gegner, Projektile, Power-ups) | M | [016](SMS-016-metasprite-komposition.md) | Teilweise – ohne Drops/Power-ups |
| [SMS-018](SMS-018-png-import.md) | PNG-Import | L | [004](SMS-004-sms-core-hw-primitive.md), [012](SMS-012-tile-editor.md), [013](SMS-013-metatile-editor.md) | Offen |

## Epic C – Level-Editor (M2)

| ID | Titel | Größe | Abhängigkeiten | Status |
|---|---|---|---|---|
| [SMS-020](SMS-020-level-verwaltung.md) | Level-Verwaltung | S | [007](SMS-007-projektmodell-persistenz.md) | Erledigt (v0) |
| [SMS-021](SMS-021-level-streifen-canvas.md) | Level-Streifen-Canvas | L | [013](SMS-013-metatile-editor.md), [020](SMS-020-level-verwaltung.md) | Teilweise – ohne Minimap |
| [SMS-022](SMS-022-pinsel-werkzeuge.md) | Pinsel-Werkzeuge | M | [021](SMS-021-level-streifen-canvas.md) | Teilweise – ohne Stempel/Copy-Paste |
| [SMS-023](SMS-023-ebene-kollision.md) | Ebene Kollision/Attribute | M | [022](SMS-022-pinsel-werkzeuge.md) | Teilweise – nur „tödlich“ je Pinsel, keine eigene Ebene |
| [SMS-024](SMS-024-ebene-ereignisse.md) | Ebene Ereignisse | M | [021](SMS-021-level-streifen-canvas.md) | Erledigt (v0) – Typen Formation, Tempo, Musik, Warten, Checkpoint |
| [SMS-025](SMS-025-level-compiler.md) | Level-Compiler | M | [003](SMS-003-datenvertrag-v1.md), [013](SMS-013-metatile-editor.md), [023](SMS-023-ebene-kollision.md), [024](SMS-024-ebene-ereignisse.md) | Teilweise – ohne RLE |
| [SMS-026](SMS-026-engine-scroll-streaming.md) | Engine: Scrolling & Streaming H/V | L | [008](SMS-008-engine-durchstich.md), [025](SMS-025-level-compiler.md) | Teilweise – ohne HUD-Lock |
| [SMS-027](SMS-027-ab-hier-spielen.md) | „Ab hier spielen“ | S | [006](SMS-006-emulator-einbettung.md), [026](SMS-026-engine-scroll-streaming.md) | Erledigt (v0) – Unverwundbar und Neustart, ohne Hitbox-Anzeige |

## Epic D – Formationen & Gegner (M3)

| ID | Titel | Größe | Abhängigkeiten | Status |
|---|---|---|---|---|
| [SMS-030](SMS-030-formations-buehne-pfad.md) | Formations-Bühne & Pfad-Werkzeug | L | [017](SMS-017-objekttypen.md) | Erledigt (v0) |
| [SMS-031](SMS-031-verband-kette-block.md) | Verband: Kette / Block | M | [030](SMS-030-formations-buehne-pfad.md) | Erledigt (v0) |
| [SMS-032](SMS-032-zeitleiste-keyframes.md) | Zeitleiste & Ereignis-Keyframes | L | [031](SMS-031-verband-kette-block.md) | Offen |
| [SMS-033](SMS-033-vorschau-player.md) | Vorschau-Player | M | [032](SMS-032-zeitleiste-keyframes.md) | Erledigt (v0) |
| [SMS-034](SMS-034-presets-helfer.md) | Presets & Helfer | S | [030](SMS-030-formations-buehne-pfad.md) | Erledigt (v0) |
| [SMS-035](SMS-035-scanline-limit-analyse.md) | Scanline- & Limit-Analyse | M | [033](SMS-033-vorschau-player.md), [016](SMS-016-metasprite-komposition.md) | Teilweise – nur im Formations-Editor |
| [SMS-036](SMS-036-pfad-backen.md) | Pfad-Backen | M | [003](SMS-003-datenvertrag-v1.md), [030](SMS-030-formations-buehne-pfad.md) | Erledigt (v0) |
| [SMS-037](SMS-037-engine-gegner-vm.md) | Engine: Gegner-VM | L | [026](SMS-026-engine-scroll-streaming.md), [036](SMS-036-pfad-backen.md) | Erledigt (v0) |

## Epic E – Gameplay (M4)

| ID | Titel | Größe | Abhängigkeiten | Status |
|---|---|---|---|---|
| [SMS-040](SMS-040-engine-spieler.md) | Engine: Spieler & Steuerung | M | [008](SMS-008-engine-durchstich.md), [017](SMS-017-objekttypen.md) | Erledigt (v0) |
| [SMS-041](SMS-041-projektile-schussmuster.md) | Projektile & Schussmuster | L | [017](SMS-017-objekttypen.md), [037](SMS-037-engine-gegner-vm.md) | Teilweise – Gegner: gerade/gezielt/Fächer 3; Kreis, Spieler-Waffenstufen und Vorschau im Formations-Editor offen |
| [SMS-042](SMS-042-kollision.md) | Kollision | M | [040](SMS-040-engine-spieler.md), [041](SMS-041-projektile-schussmuster.md) | Teilweise – Gegnerschüsse und tödliche Pinsel ja; ohne „fest“ und Hitbox-Anzeige |
| [SMS-043](SMS-043-sprite-multiplexing.md) | Sprite-Multiplexing/Flicker | M | [037](SMS-037-engine-gegner-vm.md) | Erledigt (v0) |
| [SMS-044](SMS-044-hud-score-leben.md) | HUD, Score, Leben | M | [026](SMS-026-engine-scroll-streaming.md) | Offen |
| [SMS-045](SMS-045-spielfluss.md) | Spielfluss | M | [044](SMS-044-hud-score-leben.md) | Teilweise – Level-Abfolge, Neustart, Checkpoints; kein Titel |
| [SMS-046](SMS-046-power-ups.md) | Power-ups | M | [041](SMS-041-projektile-schussmuster.md), [042](SMS-042-kollision.md) | Offen |
| [SMS-047](SMS-047-boss-editor.md) | Boss-Editor | L | [037](SMS-037-engine-gegner-vm.md), [041](SMS-041-projektile-schussmuster.md), [042](SMS-042-kollision.md) | Offen – Bosse vorerst aus Ereignissen (Stopp, Musik, zäher Gegner, Warten) |

## Epic F – Sound & Polish (M5)

| ID | Titel | Größe | Abhängigkeiten | Status |
|---|---|---|---|---|
| [SMS-050](SMS-050-sfx-presets-psg.md) | SFX-Presets & PSG-Treiber | M | [008](SMS-008-engine-durchstich.md) | Erledigt (v0) |
| [SMS-051](SMS-051-sfx-editor.md) | SFX-Editor | M | [050](SMS-050-sfx-presets-psg.md) | Erledigt (v0) – plus Musik-Editor (Piano-Roll) statt Import |
| [SMS-052](SMS-052-musik-import.md) | Musik-Import | M | [050](SMS-050-sfx-presets-psg.md) | Offen |
| [SMS-053](SMS-053-titelbild-editor.md) | Titelbild-Editor | S | [018](SMS-018-png-import.md) | Offen |
| [SMS-054](SMS-054-validierungs-dashboard.md) | Validierungs-Dashboard | M | [014](SMS-014-tile-budget-dedup.md), [035](SMS-035-scanline-limit-analyse.md), [025](SMS-025-level-compiler.md) | Teilweise – Problem-Panel mit Sprung zur Ursache, Fehler sperren Spielen/Export; Tile-Budget je Level und Scanline-Warnung nicht im Panel |
| [SMS-055](SMS-055-beispielprojekt-onboarding.md) | Beispielprojekt & Onboarding | M | [045](SMS-045-spielfluss.md) | Teilweise – Demo, Tour, leere Vorlagen, Checkliste; keine Tooltips zu Hardware-Grenzen |
| [SMS-056](SMS-056-parallax-baender.md) | (Optional) Parallax-Bänder | L | [026](SMS-026-engine-scroll-streaming.md) | Offen |
