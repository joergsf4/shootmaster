# SMS-002 – Engine-Toolchain (devkitSMS/SDCC)

| Epic | Meilenstein | Größe | Status |
|---|---|---|---|
| A – Fundament | M0 | M | Erledigt (v0) |

## Beschreibung
Reproduzierbarer Build der Z80-Engine. Toolchain (SDCC, devkitSMS, SMSlib, ihx2sms) in einem Docker-Image, damit jede:r Entwickler:in dieselbe Binary erzeugt. Ergebnis wird als Artefakt in den Editor übernommen.

## Akzeptanzkriterien
- [ ] `engine/Dockerfile` mit festgepinnten Versionen von SDCC und devkitSMS
- [ ] `make` erzeugt `engine/dist/engine.sms` und `engine/dist/layout.json`
- [ ] `layout.json` enthält: Formatversion, Adresse der Datenzeigertabelle, erste freie Bank, Engine-Größe
- [ ] Script kopiert Artefakte nach `apps/editor/public/engine/`
- [ ] Lizenzen von devkitSMS, SMSlib, PSGlib in `docs/licenses.md` dokumentiert

## Abhängigkeiten
- [SMS-001 – Monorepo-Setup](SMS-001-monorepo-setup.md)

## Hinweise / Risiken
- Risiko: SDCC-Codequalität für Hot-Loops – kritische Routinen (Sprite-Upload, Streaming) in ASM einplanen.

---
Kontext: [Projektplan](../PLAN.md)

## Umsetzung (Abweichung vom Plan)
Statt devkitSMS/SDCC im Docker-Image ist die Engine in Z80-Assembler geschrieben und wird mit dem npm-Paket `z80-asm` (MIT) gebaut (`pnpm build:engine`). Der Grund: Docker/SDCC waren nicht verfügbar, und eine reine JS-Toolchain macht spätere Builds im Browser möglich. Da der Assembler zu weite relative Sprünge nicht meldet, prüft `engine/build.mjs` die Reichweite von `jr` und `djnz` selbst.
