# SMS-008 – Engine-Durchstich (Vertical Slice)

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | L | Offen |

## Beschreibung
Erster End-to-End-Beweis der Architektur: ein aus einem Test-JSON im Browser erzeugtes ROM läuft im eingebetteten Emulator.

## Akzeptanzkriterien
- [ ] Engine lädt Paletten und Tiles aus der Datenbank in VRAM
- [ ] Testlevel (fest im JSON) scrollt horizontal UND (separates Level) vertikal
- [ ] Ein Spieler-Sprite ist mit dem Steuerkreuz bewegbar
- [ ] Ablauf: Test-JSON → Button „Play“ → ROM baut → Emulator startet, in < 2 s
- [ ] Dasselbe ROM läuft in einem externen Emulator (Emulicious oder MEKA)

## Abhängigkeiten
- [SMS-002 – Engine-Toolchain (devkitSMS/SDCC)](SMS-002-engine-toolchain.md)
- [SMS-003 – Datenvertrag v1 (Binärformat Engine ↔ Editor)](SMS-003-datenvertrag-v1.md)
- [SMS-005 – ROM-Builder](SMS-005-rom-builder.md)
- [SMS-006 – Emulator-Einbettung](SMS-006-emulator-einbettung.md)

## Hinweise / Risiken
- Exit-Kriterium für Meilenstein M0. Vor Abschluss keine großen Editor-Investitionen.

---
Kontext: [Projektplan](../PLAN.md)
