# SMS-026 – Engine: Scrolling & Streaming H/V

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| C – Level-Editor | M2 | L | Offen |

## Beschreibung
Engine-Seite des Levels: weiches Scrollen mit Nachladen.

## Akzeptanzkriterien
- [ ] Horizontal: Spalte (2 Tiles breit) wird im VBlank in die Name Table gestreamt; linke 8 px maskiert
- [ ] Vertikal: Zeile wird im VBlank gestreamt, Wrap bei 28 Zeilen korrekt
- [ ] HUD-Zeilen fixiert (H-Scroll-Lock oben bzw. Lösung für vertikal dokumentiert)
- [ ] Variables Scrolltempo inkl. Stopp (für Boss)
- [ ] Keine Glitches an Wrap-Grenzen, gemessen über komplettes Testlevel

## Abhängigkeiten
- [SMS-008 – Engine-Durchstich (Vertical Slice)](SMS-008-engine-durchstich.md)
- [SMS-025 – Level-Compiler](SMS-025-level-compiler.md)

## Hinweise / Risiken
- Hinweis: Vertikaler HUD-Lock existiert nur für die rechten 8 Spalten – HUD bei vertikalen Leveln ggf. über Sprites oder rechts.

---
Kontext: [Projektplan](../PLAN.md)
