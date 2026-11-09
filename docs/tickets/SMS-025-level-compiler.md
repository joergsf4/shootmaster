# SMS-025 – Level-Compiler

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| C – Level-Editor | M2 | M | Offen |

## Beschreibung
Übersetzt Level-Daten in das Binärformat des Datenvertrags.

## Akzeptanzkriterien
- [ ] Metatile-Map spalten- (H) bzw. zeilenweise (V) serialisiert, optional RLE
- [ ] Kollisionsattribute und Ereignisliste (sortiert nach Scrollposition) serialisiert
- [ ] Größenanzeige pro Level in Bytes und Banks
- [ ] Roundtrip-Test: kompilieren → dekodieren ergibt identische Map

## Abhängigkeiten
- [SMS-003 – Datenvertrag v1 (Binärformat Engine ↔ Editor)](SMS-003-datenvertrag-v1.md)
- [SMS-013 – Metatile-Editor](SMS-013-metatile-editor.md)
- [SMS-023 – Ebene Kollision/Attribute](SMS-023-ebene-kollision.md)
- [SMS-024 – Ebene Ereignisse](SMS-024-ebene-ereignisse.md)

---
Kontext: [Projektplan](../PLAN.md)
