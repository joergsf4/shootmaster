# SMS-006 – Emulator-Einbettung

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | L | Offen |

## Beschreibung
Eingebetteter SMS-Emulator, um das erzeugte ROM direkt im Browser zu testen.

## Akzeptanzkriterien
- [ ] Evaluierung von mind. 2 Kandidaten (JS- oder WASM-Emulator) inkl. Lizenzprüfung, Entscheidung dokumentiert
- [ ] ROM aus Speicher (ArrayBuffer) laden, ohne Dateidownload
- [ ] Steuerung per Tastatur und Gamepad-API, Belegung konfigurierbar
- [ ] Pause, Reset, Lautstärke, Vollbild, Skalierung ganzzahlig
- [ ] Läuft stabil mit 60 fps (NTSC) in Chrome und Firefox

## Abhängigkeiten
- [SMS-001 – Monorepo-Setup](SMS-001-monorepo-setup.md)

## Hinweise / Risiken
- Risiko: GPL-Lizenz des Emulators – ggf. als separat ausgeliefertes Modul isolieren.

---
Kontext: [Projektplan](../PLAN.md)
