# SMS-003 – Datenvertrag v1 (Binärformat Engine ↔ Editor)

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | M | Offen |

## Beschreibung
Das zentrale Architektur-Artefakt: Beschreibung aller Datenstrukturen, die der Editor erzeugt und die Engine liest. Wird in `docs/data-format.md` gepflegt und versioniert.

## Akzeptanzkriterien
- [ ] Zeigertabelle (feste Adresse, je Eintrag Bank + Offset) spezifiziert
- [ ] Formate spezifiziert: Paletten, Tiles (4bpp planar), Metatiles, Level-Map, Kollisionsattribute, Ereignisliste, Sprites/Metasprites, Animationen, Pfade (Delta + RLE), Formations-Bytecode, Objekttypen, HUD-Config
- [ ] Bank-Regeln festgelegt (keine Struktur über Bankgrenze, oder explizit erlaubt)
- [ ] Formatversion im Daten-Header; Engine prüft Version und zeigt Fehlerbildschirm bei Mismatch
- [ ] Review durch Engine- und Editor-Seite

## Abhängigkeiten
- [SMS-002 – Engine-Toolchain (devkitSMS/SDCC)](SMS-002-engine-toolchain.md)

## Hinweise / Risiken
- Bei jeder Änderung: Version erhöhen + Changelog im Dokument.

---
Kontext: [Projektplan](../PLAN.md)
