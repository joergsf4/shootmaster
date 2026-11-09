# SMS-004 – sms-core: Hardware-Primitive

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | M | Offen |

## Beschreibung
Reine TypeScript-Bibliothek für SMS-Hardwareformate, ohne UI-Abhängigkeit.

## Akzeptanzkriterien
- [ ] RGB ↔ SMS-Farbe (2 Bit/Kanal, 64 Farben), nächste-Farbe-Suche
- [ ] Tile-Encoding 8×8 Pixel-Indizes → 32 Byte planar 4bpp und zurück
- [ ] Name-Table-Wort (Tile-Index 9 Bit, H-Flip, V-Flip, Palette, Priorität) kodieren/dekodieren
- [ ] Tile-Hash inkl. Erkennung gespiegelter Duplikate (H, V, HV)
- [ ] Unit-Tests gegen bekannte Referenz-Bytefolgen, Coverage > 90 %

## Abhängigkeiten
- [SMS-001 – Monorepo-Setup](SMS-001-monorepo-setup.md)

---
Kontext: [Projektplan](../PLAN.md)
