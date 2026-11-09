# SMS-035 – Scanline- & Limit-Analyse

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| D – Formationen & Gegner | M3 | M | Offen |

## Beschreibung
Hardwaregrenzen schon beim Entwerfen sichtbar machen.

## Akzeptanzkriterien
- [ ] Heatmap am Bühnenrand: max. HW-Sprites pro Scanline über die gesamte Animation
- [ ] Warnung > 8 (Flicker) mit Sprung zum kritischen Frame
- [ ] Anzeige gleichzeitiger Objekte vs. Engine-Pool (z. B. 16 Gegner, 24 Gegnerschüsse)
- [ ] Im Level-Editor: Analyse über überlappende Formationen hinweg

## Abhängigkeiten
- [SMS-033 – Vorschau-Player](SMS-033-vorschau-player.md)
- [SMS-016 – Metasprite-Komposition](SMS-016-metasprite-komposition.md)

---
Kontext: [Projektplan](../PLAN.md)
