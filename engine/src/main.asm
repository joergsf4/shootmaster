; =====================================================================
;  SMS Shoot 'em Up Engine  –  Datenformat v1 (docs/data-format.md)
;  Bank 0 (Slot 0): diese Engine
;  Bank 1 (Slot 2, $8000): globale Daten
;  Bank n (Slot 1, $4000): Level-Daten / BG-Tiles
; =====================================================================

VDP_DATA    equ $BE
VDP_CTRL    equ $BF
PORT_JOY    equ $DC
PSG         equ $7F
MAPPER1     equ $FFFE
MAPPER2     equ $FFFF

MAXE        equ 12
MAXS        equ 6
MAXB        equ 16         ; Gegnerschüsse (Zweierpotenz: Rotation per and)
OBJ         equ 16

; ---- globale Daten (Slot 2) ----
G_VERSION   equ $8004
G_LEVELS    equ $8005
G_SPRPAL    equ $8008
G_SPRCOUNT  equ $8018
G_SPRPTR    equ $801A
G_LVLBANKS  equ $801C
G_PLAYER    equ $801E
G_ETYPES    equ $8020
G_EXPL      equ $8022
G_SONGS     equ $8024
G_SFX       equ $8026
G_PERIODS   equ $8028
G_SND_SHOT  equ $802A
G_SND_EXPL  equ $802B
G_SND_HIT   equ $802C
G_SOUNDTEST equ $802D
G_INVINC    equ $802E      ; Test-ROM: Treffer kosten kein Leben

; ---- Spielerdefinition ----
P_SPEED     equ 0
P_HBX       equ 1
P_HBY       equ 2
P_HBW       equ 3
P_HBH       equ 4
P_MINX      equ 5
P_MAXX      equ 6
P_MINY      equ 7
P_MAXY      equ 8
P_ANIM      equ 9
P_SANIM     equ 11
P_SSPEED    equ 13
P_SHBX      equ 14
P_SHBY      equ 15
P_SHBW      equ 16
P_SHBH      equ 17
P_RATE      equ 18
P_SOFFX     equ 19
P_SOFFY     equ 20
P_LIVES     equ 21

; ---- Gegnertyp (16 Byte) ----
T_HP        equ 0
T_HBX       equ 1
T_HBY       equ 2
T_HBW       equ 3
T_HBH       equ 4
T_ANIM      equ 5
T_SHOT      equ 8          ; → Schussdefinition (0 = schießt nicht)

; ---- Schussdefinition (Gegnertyp) ----
S_PATTERN   equ 0          ; 1 gerade, 2 gezielt, 3 Fächer (3, gezielt)
S_RATE      equ 1          ; Frames zwischen Schüssen
S_ANIM      equ 2
S_HBX       equ 4
S_HBY       equ 5
S_HBW       equ 6
S_HBH       equ 7
S_OFFX      equ 8          ; Gegner (oben links) → Schuss (oben links), int8
S_OFFY      equ 9
S_AIMX      equ 10         ; Zielversatz: Spieler-Hitbox-Mitte − Schuss-Hitbox-Mitte, int8
S_AIMY      equ 11
S_VEL       equ 12         ; 16 Richtungen × (vx, vy) je 16 Bit, 8.8 mit Vorzeichen; 0 = rechts, 4 = unten

; ---- Level-Header (Slot 1) ----
L_ORIENT    equ $4000
L_LEN       equ $4001
L_SPEED     equ $4003
L_PAL       equ $4004
L_MT        equ $4014
L_MAP       equ $4016
L_EV        equ $4018
L_FORM      equ $401A
L_TBANK     equ $401C
L_TPTR      equ $401D
L_TCOUNT    equ $401F
L_CAMMAX    equ $4021
L_STARTX    equ $4023
L_STARTY    equ $4024
L_MUSIC     equ $4025
L_SOLID     equ $4026
L_STARTCAM  equ $4028

; ---- Objektstruktur (16 Byte) ----
O_STATE     equ 0      ; 0 frei, 1 wartet, 2 aktiv, 3 explodiert
O_DELAY     equ 1
O_X         equ 2      ; 16 Bit
O_Y         equ 4      ; 16 Bit
O_PATH      equ 6
O_RUN       equ 8
O_DX        equ 9
O_DY        equ 10
O_TYPE      equ 11
O_HP        equ 12
O_ATICK     equ 13
O_AFRAME    equ 14
O_TIMER     equ 15

; ---- Gegnerschuss (16 Byte; O_STATE, O_X/O_Y = Pixel, Animation wie Objekt) ----
B_XF        equ 1          ; Nachkommastellen x
B_DEF       equ 6          ; → Schussdefinition
B_YF        equ 8          ; Nachkommastellen y
B_VX        equ 9          ; Tempo x, 8.8 mit Vorzeichen
B_VY        equ 11         ; Tempo y

; ---- RAM ----
vblank      equ $C000
frame       equ $C001
joy         equ $C002
joyPrev     equ $C003
paused      equ $C004
orient      equ $C005
camPos      equ $C006
camFrac     equ $C008
speedInt    equ $C009
speedFrac   equ $C00A
scrollReg   equ $C00B
camMax      equ $C00C
evPtr       equ $C00E
streamPend  equ $C010
streamIdx   equ $C011
levelIdx    equ $C013
levelBank   equ $C014
mtBase      equ $C015
mapBase     equ $C017
levelLen    equ $C019
half        equ $C01B
sprCount    equ $C01C
rot         equ $C01D
lives       equ $C01E
cooldown    equ $C01F
tmpType     equ $C020
tmpX        equ $C021
tmpY        equ $C023
tmpPath     equ $C025
tmpBank     equ $C027
tmpPtr      equ $C028
tmpCount    equ $C02A
endTimer    equ $C02C
solidBase   equ $C02E      ; Tabelle: tödlich je Pinsel
hbX         equ $C030
hbY         equ $C031
hbW         equ $C032
hbH         equ $C033
shX         equ $C034
shY         equ $C035
shW         equ $C036
shH         equ $C037
waitClr     equ $C038      ; ≠ 0: Kamera hält, bis alle Gegner-Slots frei sind
curSpeed    equ $C039      ; aktuelles Scrolltempo 4.4
curSong     equ $C03A      ; aktueller Song ($FF = Stille)
ckSpeed     equ $C03B      ; Checkpoint: Tempo, Song, Ereigniszeiger (0 = keiner), Kamera
ckSong      equ $C03C
ckEv        equ $C050
ckCam       equ $C052
bulCount    equ $C054      ; aktive Gegnerschüsse (0: Schleifen über den Pool entfallen)
musPtr      equ $C040      ; Song (0 = keiner)
musData     equ $C042      ; Schritte Kanal 0
musLen      equ $C044
musTempo    equ $C045
musTick     equ $C046
musStep     equ $C047
sfxLeft     equ $C048
sfxCh       equ $C049
sfxPtr      equ $C04A
sfxNoise    equ $C04C      ; zuletzt geschriebener Rauschmodus des Effekts
chState     equ $C060      ; 4 Kanäle x (Lautstärke, Abklingrate, Zähler, Dämpfung)
chAtt       equ $C063
player      equ $C080
satY        equ $C100
satXT       equ $C140
enemies     equ $C200
shots       equ $C300
bullets     equ $C400      ; MAXB × 16 Byte = genau eine 256-Byte-Seite (Schleifen laufen über das Low-Byte)

; =====================================================================
    org $0000
    di
    db $ED,$56              ; im 1
    ld sp,$DFF0
    jp init

    ds $38-$,0
; ---- IRQ: VBlank ----
    push af
    in a,(VDP_CTRL)
    ld a,1
    ld (vblank),a
    pop af
    ei
    reti

    ds $66-$,0
; ---- NMI: Pause-Taste ----
    push af
    ld a,(paused)
    xor 1
    ld (paused),a
    pop af
    db $ED,$45              ; retn

; =====================================================================
init:
    xor a
    ld ($FFFC),a
    ld ($FFFD),a
    ld a,1
    ld (MAPPER2),a
    ld a,3
    ld (MAPPER1),a
    ; RAM löschen
    ld hl,$C000
    ld de,$C001
    ld bc,$1FEF
    ld (hl),0
    ldir
    ; VDP-Register
    ld hl,vdpInit
    ld b,22
    ld c,VDP_CTRL
    otir
    ; Datenformat prüfen
    ld a,($8000)
    cp 'S'
    jp nz,fatal
    ld a,(G_VERSION)
    cp 3
    jp nz,fatal
    ; VRAM löschen
    ld hl,$0000
    call vramWrite
    ld bc,$4000
clrVram:
    xor a
    out (VDP_DATA),a
    dec bc
    ld a,b
    or c
    jr nz,clrVram
    ; Sprite-Palette
    ld a,16
    out (VDP_CTRL),a
    ld a,$C0
    out (VDP_CTRL),a
    ld hl,G_SPRPAL
    ld b,16
    ld c,VDP_DATA
    otir
    ; Sprite-Tiles nach $2000
    ld hl,$2000
    call vramWrite
    ld hl,(G_SPRCOUNT)
    call mul32
    ld b,h
    ld c,l
    ld hl,(G_SPRPTR)
    call copyToVdp
    ; Soundtest-ROM: nur Song oder Effekt abspielen
    ld a,$FF
    call musicStart
    ld a,(G_SOUNDTEST)
    or a
    jr z,noSoundTest
    bit 7,a
    jr nz,stSfx
    dec a
    call musicStart
    jr stLoop
stSfx:
    and $7F
    call playSfx
stLoop:
    ei
stWait:
    call waitVblank
    call soundUpdate
    jr stWait
noSoundTest:
    xor a
    ld (levelIdx),a

; ---------------------------------------------------------------------
startLevel:
    di
    ld sp,$DFF0
    ld a,$A2                ; Display aus
    out (VDP_CTRL),a
    ld a,$81
    out (VDP_CTRL),a
    ; Level-Bank
    ld hl,(G_LVLBANKS)
    ld a,(levelIdx)
    ld e,a
    ld d,0
    add hl,de
    ld a,(hl)
    ld (levelBank),a
    ld (MAPPER1),a
    ; BG-Palette
    xor a
    out (VDP_CTRL),a
    ld a,$C0
    out (VDP_CTRL),a
    ld hl,L_PAL
    ld b,16
    ld c,VDP_DATA
    otir
    ; Tile-Infos merken, dann Tile-Bank einblenden
    ld a,(L_TBANK)
    ld (tmpBank),a
    ld hl,(L_TPTR)
    ld (tmpPtr),hl
    ld hl,(L_TCOUNT)
    ld (tmpCount),hl
    ; Level-Variablen
    ld a,(L_ORIENT)
    ld (orient),a
    ld hl,(L_LEN)
    ld (levelLen),hl
    ld hl,(L_MT)
    ld (mtBase),hl
    ld hl,(L_MAP)
    ld (mapBase),hl
    ; Neustart-Stand: ohne Checkpoint Levelanfang bzw. Startkamera
    ld hl,(ckEv)
    ld a,h
    or l
    jr nz,haveCk
    ld hl,(L_EV)
    ld (ckEv),hl
    ld hl,(L_STARTCAM)
    ld (ckCam),hl
    ld a,(L_SPEED)
    ld (ckSpeed),a
    ld a,(L_MUSIC)
    ld (ckSong),a
haveCk:
    ld hl,(ckEv)
    ld (evPtr),hl
    ld hl,(L_CAMMAX)
    ld (camMax),hl
    ld hl,(L_SOLID)
    ld (solidBase),hl
    ld a,(ckSpeed)
    call setSpeed
    ld a,(L_STARTX)
    ld (player+O_X),a
    ld a,(L_STARTY)
    ld (player+O_Y),a
    ; Tiles kopieren
    ld a,(tmpBank)
    ld (MAPPER1),a
    ld hl,$0000
    call vramWrite
    ld hl,(tmpCount)
    call mul32
    ld b,h
    ld c,l
    ld hl,(tmpPtr)
    call copyToVdp
    ld a,(levelBank)
    ld (MAPPER1),a
    ; Name Table löschen
    ld hl,$3800
    call vramWrite
    ld bc,$700
clrNt:
    xor a
    out (VDP_DATA),a
    dec bc
    ld a,b
    or c
    jr nz,clrNt
    ; Objekte löschen (Gegner, Schüsse, Gegnerschüsse: $C200-$C4FF)
    ld hl,enemies
    ld de,enemies+1
    ld bc,$2FF
    ld (hl),0
    ldir
    ld hl,(ckCam)           ; 0 = Levelanfang, sonst „Ab hier spielen“ bzw. Checkpoint
    ld (camPos),hl
    xor a
    ld (camFrac),a
    ld (waitClr),a
    ld (bulCount),a
    ld (streamPend),a
    ld (cooldown),a
    ld (endTimer),a
    ld (paused),a
    ld (player+O_X+1),a
    ld (player+O_Y+1),a
    ld (player+O_ATICK),a
    ld (player+O_AFRAME),a
    ld a,2
    ld (player+O_STATE),a
    ld a,90
    ld (player+O_TIMER),a
    ld a,(lives)
    or a
    jr nz,haveLives
    ld ix,(G_PLAYER)
    ld a,(ix+P_LIVES)
    ld (lives),a
haveLives:
    ; Startbild ab Tile camPos/8 aufbauen (wie nach dem Scrollen dorthin)
    ld a,(orient)
    or a
    jr nz,initV
    ld a,(camPos)           ; horizontal: scrollReg = -camPos
    neg
    ld (scrollReg),a
    call camTile
    ld b,33
initHLoop:
    push bc
    push hl
    call drawColumn
    pop hl
    pop bc
    inc hl
    djnz initHLoop
    jr initDone
initV:
    ld hl,(camPos)          ; vertikal: scrollReg = (32 - camPos) mod 224
    ld de,224
initVMod:
    or a
    sbc hl,de
    jr nc,initVMod
    add hl,de
    ld a,32
    sub l
    jr nc,initVSet
    add a,224
initVSet:
    ld (scrollReg),a
    call camTile
    ld b,27
initVLoop:
    push bc
    push hl
    call drawRow
    pop hl
    pop bc
    inc hl
    djnz initVLoop
initDone:
    ; Scrollregister
    xor a
    out (VDP_CTRL),a
    ld a,$88
    out (VDP_CTRL),a
    xor a
    out (VDP_CTRL),a
    ld a,$89
    out (VDP_CTRL),a
    call setScroll
    call buildSat
    call uploadSat
    ld a,(ckSong)
    call musicStart
    ld a,$E2                ; Display an, VBlank-IRQ, 8x16-Sprites
    out (VDP_CTRL),a
    ld a,$81
    out (VDP_CTRL),a
    ei

; =====================================================================
mainLoop:
    call waitVblank
    call uploadSat
    call doStreaming
    call setScroll
    call readJoy
    call soundUpdate
    ld a,(paused)
    or a
    jr nz,mainLoop
    call updateCamera
    call processEvents
    call updatePlayer
    call updateShots
    call updateEnemies
    call updateBullets
    call collide
    call bulletCollide
    call bgCollide
    call checkLevelEnd
    call buildSat
    ld hl,frame
    inc (hl)
    jr mainLoop

waitVblank:
    xor a
    ld (vblank),a
wvLoop:
    halt
    ld a,(vblank)
    or a
    jr z,wvLoop
    ret

fatal:
    ld a,16
    out (VDP_CTRL),a
    ld a,$C0
    out (VDP_CTRL),a
    ld a,$03
    out (VDP_DATA),a
    ld a,$C0
    out (VDP_CTRL),a
    ld a,$81
    out (VDP_CTRL),a
    di
fatalLoop:
    halt
    jr fatalLoop

; ---------------------------------------------------------------------
; Hilfsroutinen
; ---------------------------------------------------------------------
vramWrite:                  ; HL = VRAM-Adresse
    ld a,l
    out (VDP_CTRL),a
    ld a,h
    or $40
    out (VDP_CTRL),a
    ret

copyToVdp:                  ; HL = Quelle, BC = Bytes
    ld a,b
    or c
    ret z
ctvLoop:
    ld a,(hl)
    out (VDP_DATA),a
    inc hl
    dec bc
    ld a,b
    or c
    jr nz,ctvLoop
    ret

camTile:                    ; HL = camPos / 8
    ld hl,(camPos)
    srl h
    rr l
    srl h
    rr l
    srl h
    rr l
    ret

mul32:                      ; HL *= 32
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    ret

sext:                       ; A → DE (vorzeichenerweitert)
    ld e,a
    add a,a
    sbc a,a
    ld d,a
    ret

readJoy:
    in a,(PORT_JOY)
    cpl
    and $3F
    ld b,a
    ld a,(joy)
    ld (joyPrev),a
    ld a,b
    ld (joy),a
    ret

setScroll:
    ld a,(scrollReg)
    out (VDP_CTRL),a
    ld a,(orient)
    or a
    ld a,$88
    jr z,ssOut
    ld a,$89
ssOut:
    out (VDP_CTRL),a
    ret

uploadSat:
    ld hl,$3F00
    call vramWrite
    ld hl,satY
    ld b,64
    ld c,VDP_DATA
    otir
    ld hl,$3F80
    call vramWrite
    ld hl,satXT
    ld b,128
    otir
    ret

; ---------------------------------------------------------------------
; Scrolling
; ---------------------------------------------------------------------
updateCamera:
    ld a,(waitClr)
    or a
    ret nz
    ld a,(camFrac)
    ld b,a
    ld a,(speedFrac)
    add a,b
    ld (camFrac),a
    ld a,(speedInt)
    adc a,0
    ret z
    ld b,a
ucLoop:
    ld hl,(camPos)
    ld de,(camMax)
    or a
    sbc hl,de
    ret nc                  ; Levelende erreicht
    ld hl,(camPos)
    inc hl
    ld (camPos),hl
    ld a,(orient)
    or a
    jr nz,ucV
    ld a,(scrollReg)
    dec a
    ld (scrollReg),a
    ld de,32
    jr ucChk
ucV:
    ld a,(scrollReg)
    or a
    jr nz,ucV2
    ld a,224
ucV2:
    dec a
    ld (scrollReg),a
    ld de,26
ucChk:
    ld a,l
    and 7
    jr nz,ucNext
    srl h
    rr l
    srl h
    rr l
    srl h
    rr l
    add hl,de
    ld (streamIdx),hl
    ld a,1
    ld (streamPend),a
ucNext:
    djnz ucLoop
    ret

doStreaming:
    ld a,(streamPend)
    or a
    ret z
    xor a
    ld (streamPend),a
    ld hl,(streamIdx)
    ld a,(orient)
    or a
    jp z,drawColumn
    jp drawRow

; HL = Tile-Spalte (horizontales Level)
drawColumn:
    ld a,l
    and 1
    ld (half),a
    ld a,l
    and 31
    add a,a
    ld e,a
    ld d,$38
    push de                 ; Name-Table-Adresse Zeile 0
    srl h
    rr l                    ; HL = Metatile-Spalte
    ld de,(levelLen)
    push hl
    or a
    sbc hl,de
    pop hl
    jr c,dcIn
    ld hl,emptyMap
    jr dcGo
dcIn:
    add hl,hl
    add hl,hl
    ld d,h
    ld e,l
    add hl,hl
    add hl,de               ; *12
    ld de,(mapBase)
    add hl,de
dcGo:
    pop de                  ; DE = NT-Adresse
    ld b,12
dcRow:
    push bc
    ld a,(hl)
    inc hl
    push hl
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    ld a,(half)
    add a,a
    add a,l
    ld l,a
    ld bc,(mtBase)
    add hl,bc
    ex de,hl                ; HL = NT, DE = Metatile-Eintrag
    call vramWrite
    ld a,(de)
    out (VDP_DATA),a
    inc de
    ld a,(de)
    out (VDP_DATA),a
    inc de
    inc de
    inc de
    ld bc,64
    add hl,bc
    call vramWrite
    ld a,(de)
    out (VDP_DATA),a
    inc de
    ld a,(de)
    out (VDP_DATA),a
    add hl,bc
    ex de,hl
    pop hl
    pop bc
    djnz dcRow
    ret

; HL = Tile-Zeile (vertikales Level, 0 = unten)
drawRow:
    push hl
    ld de,28
drMod:
    or a
    sbc hl,de
    jr nc,drMod
    add hl,de
    ld a,27
    sub l
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    ld de,$3800
    add hl,de
    call vramWrite
    pop hl
    ld a,l
    and 1
    ld (half),a
    srl h
    rr l
    ld de,(levelLen)
    push hl
    or a
    sbc hl,de
    pop hl
    jr c,drIn
    ld hl,emptyMap
    jr drGo
drIn:
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl               ; *16
    ld de,(mapBase)
    add hl,de
drGo:
    ld b,16
drCell:
    ld a,(hl)
    inc hl
    push hl
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    ld a,(half)
    or a
    jr nz,drTop
    ld a,l
    or 4
    ld l,a
drTop:
    ld de,(mtBase)
    add hl,de
    ld a,(hl)
    out (VDP_DATA),a
    inc hl
    ld a,(hl)
    out (VDP_DATA),a
    inc hl
    ld a,(hl)
    out (VDP_DATA),a
    inc hl
    ld a,(hl)
    out (VDP_DATA),a
    pop hl
    djnz drCell
    ret

; ---------------------------------------------------------------------
; Ereignisse & Formationen
; ---------------------------------------------------------------------
processEvents:
    ld hl,(evPtr)
    ld e,(hl)
    inc hl
    ld d,(hl)
    ld a,e
    and d
    inc a
    ret z                   ; $FFFF = Ende
    push hl
    ld hl,(camPos)
    or a
    sbc hl,de
    pop hl
    ret c                   ; noch nicht erreicht
    inc hl
    ld c,(hl)               ; Typ
    inc hl
    ld b,(hl)               ; Parameter
    inc hl
    ld a,c
    cp 4                    ; Warten, bis alle Gegner weg sind
    jr nz,peRun
    push hl
    push bc
    call anyEnemy
    pop bc
    pop hl
    ld (waitClr),a
    ret nz                  ; Ereignis bleibt stehen, Kamera hält
peRun:
    ld (evPtr),hl
    ld a,c
    dec a
    cp 5
    jr nc,processEvents     ; unbekannter Typ: überspringen
    ld hl,processEvents     ; Rücksprung: nächstes Ereignis
    push hl
    add a,a
    ld e,a
    ld d,0
    ld hl,peTable
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    ld a,b                  ; A = Parameter
    jp (hl)

peTable:
    dw spawnFormation       ; 1 Formation (lokaler Index)
    dw setSpeed             ; 2 Scrolltempo 4.4 (0 = Kamera steht)
    dw musicStart           ; 3 Song ($FF = Stille)
    dw peDone               ; 4 Warten (oben erledigt)
    dw checkpoint           ; 5 Checkpoint
peDone:
    ret

; Neustart nach Game Over ab hier; Ereignisse danach laufen erneut
checkpoint:
    ld hl,(evPtr)
    ld (ckEv),hl
    ld hl,(camPos)
    ld (ckCam),hl
    ld a,(curSpeed)
    ld (ckSpeed),a
    ld a,(curSong)
    ld (ckSong),a
    ret

; A = Tempo 4.4 → speedInt/speedFrac
setSpeed:
    ld (curSpeed),a
    ld b,a
    rrca
    rrca
    rrca
    rrca
    and $0F
    ld (speedInt),a
    ld a,b
    add a,a
    add a,a
    add a,a
    add a,a
    ld (speedFrac),a
    ret

anyEnemy:                   ; NZ (A = Zustand) = mind. ein Gegner-Slot belegt
    ld hl,enemies+O_STATE
    ld de,OBJ
    ld b,MAXE
aeLoop:
    ld a,(hl)
    or a
    ret nz
    add hl,de
    djnz aeLoop
    ret

; A = lokaler Formationsindex
spawnFormation:
    ld l,a
    ld h,0
    add hl,hl
    ld de,(L_FORM)
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    ld a,(hl)
    ld (tmpType),a
    inc hl
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld (tmpX),de
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld (tmpY),de
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld (tmpPath),de
    ld b,(hl)
    inc hl
sfMember:
    push bc
    call findFreeEnemy
    jr c,sfSkip
    ld (ix+O_STATE),1
    ld a,(hl)
    ld (ix+O_DELAY),a
    inc hl
    ld a,(hl)
    inc hl
    push hl
    call sext
    ld hl,(tmpX)
    add hl,de
    ld (ix+O_X),l
    ld (ix+O_X+1),h
    pop hl
    ld a,(hl)
    inc hl
    push hl
    call sext
    ld hl,(tmpY)
    add hl,de
    ld (ix+O_Y),l
    ld (ix+O_Y+1),h
    ld de,(tmpPath)
    ld (ix+O_PATH),e
    ld (ix+O_PATH+1),d
    xor a
    ld (ix+O_RUN),a
    ld (ix+O_ATICK),a
    ld (ix+O_AFRAME),a
    ld (ix+O_TIMER),a
    ld a,(tmpType)
    ld (ix+O_TYPE),a
    call typePtr
    ld a,(hl)
    ld (ix+O_HP),a
    pop hl
    pop bc
    djnz sfMember
    ret
sfSkip:
    inc hl
    inc hl
    inc hl
    pop bc
    djnz sfMember
    ret

findFreeEnemy:              ; IX = freier Slot, Carry = keiner frei
    push bc
    push de
    ld ix,enemies
    ld de,OBJ
    ld b,MAXE
ffeLoop:
    ld a,(ix+O_STATE)
    or a
    jr z,ffeFound
    add ix,de
    djnz ffeLoop
    pop de
    pop bc
    scf
    ret
ffeFound:
    pop de
    pop bc
    or a
    ret

typePtr:                    ; A = Typ → HL = Typdefinition
    push de
    ld l,a
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    ld de,(G_ETYPES)
    add hl,de
    pop de
    ret

; IX = Objekt, HL = Animation → Carry wenn Animation umgelaufen
animate:
    inc hl
    ld a,(ix+O_ATICK)
    inc a
    cp (hl)
    jr c,anStore
    ld (ix+O_ATICK),0
    dec hl
    ld a,(ix+O_AFRAME)
    inc a
    cp (hl)
    jr c,anFrame
    ld (ix+O_AFRAME),0
    scf
    ret
anFrame:
    ld (ix+O_AFRAME),a
    or a
    ret
anStore:
    ld (ix+O_ATICK),a
    or a
    ret

; HL = Animation, IX = Objekt → HL = aktueller Metasprite
curFrame:
    inc hl
    inc hl
    ld a,(ix+O_AFRAME)
    add a,a
    ld e,a
    ld d,0
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    ret

; ---------------------------------------------------------------------
; Spieler
; ---------------------------------------------------------------------
updatePlayer:
    ld ix,player
    ld iy,(G_PLAYER)
    ld a,(ix+O_TIMER)
    or a
    jr z,upNoInv
    dec (ix+O_TIMER)
upNoInv:
    ld a,(joy)
    ld c,a
    bit 0,c
    jr z,upNoUp
    ld a,(ix+O_Y)
    sub (iy+P_SPEED)
    jr c,upClU
    cp (iy+P_MINY)
    jr nc,upSetU
upClU:
    ld a,(iy+P_MINY)
upSetU:
    ld (ix+O_Y),a
upNoUp:
    bit 1,c
    jr z,upNoDn
    ld a,(ix+O_Y)
    add a,(iy+P_SPEED)
    jr c,upClD
    cp (iy+P_MAXY)
    jr c,upSetD
    jr z,upSetD
upClD:
    ld a,(iy+P_MAXY)
upSetD:
    ld (ix+O_Y),a
upNoDn:
    bit 2,c
    jr z,upNoL
    ld a,(ix+O_X)
    sub (iy+P_SPEED)
    jr c,upClL
    cp (iy+P_MINX)
    jr nc,upSetL
upClL:
    ld a,(iy+P_MINX)
upSetL:
    ld (ix+O_X),a
upNoL:
    bit 3,c
    jr z,upNoR
    ld a,(ix+O_X)
    add a,(iy+P_SPEED)
    jr c,upClR
    cp (iy+P_MAXX)
    jr c,upSetR
    jr z,upSetR
upClR:
    ld a,(iy+P_MAXX)
upSetR:
    ld (ix+O_X),a
upNoR:
    ; Schießen
    ld a,(cooldown)
    or a
    jr z,upCanFire
    dec a
    ld (cooldown),a
    jr upAnim
upCanFire:
    bit 4,c
    jr z,upAnim
    call fireShot
upAnim:
    ld ix,player
    ld l,(iy+P_ANIM)
    ld h,(iy+P_ANIM+1)
    call animate
    ret

fireShot:
    ld ix,shots
    ld de,OBJ
    ld b,MAXS
fsLoop:
    ld a,(ix+O_STATE)
    or a
    jr z,fsFound
    add ix,de
    djnz fsLoop
    ret
fsFound:
    ; Startposition mit Vorzeichen addieren; außerhalb des Bildschirms → kein Schuss
    ld a,(iy+P_SOFFX)
    call sext
    ld a,(player+O_X)
    ld l,a
    ld h,0
    add hl,de
    ld a,h
    or a
    ret nz
    ld (ix+O_X),l
    ld (ix+O_X+1),h
    ld a,(iy+P_SOFFY)
    call sext
    ld a,(player+O_Y)
    ld l,a
    ld h,0
    add hl,de
    ld a,h
    or a
    ret nz
    ld (ix+O_Y),l
    ld (ix+O_Y+1),h
    ld (ix+O_STATE),2
    ld (ix+O_ATICK),0
    ld (ix+O_AFRAME),0
    ld a,(iy+P_RATE)
    ld (cooldown),a
    ld a,(G_SND_SHOT)
    jp playSfx

updateShots:
    ld iy,(G_PLAYER)
    ld ix,shots
    ld b,MAXS
usLoop:
    push bc
    ld a,(ix+O_STATE)
    or a
    jr z,usNext
    ld a,(orient)
    or a
    jr nz,usV
    ld a,(ix+O_X)
    add a,(iy+P_SSPEED)
    jr c,usFree
    ld (ix+O_X),a
    jr usAnim
usV:
    ld a,(ix+O_Y)
    sub (iy+P_SSPEED)
    jr c,usFree
    ld (ix+O_Y),a
usAnim:
    ld l,(iy+P_SANIM)
    ld h,(iy+P_SANIM+1)
    call animate
    jr usNext
usFree:
    ld (ix+O_STATE),0
usNext:
    ld de,OBJ
    add ix,de
    pop bc
    djnz usLoop
    ret

; ---------------------------------------------------------------------
; Gegner
; ---------------------------------------------------------------------
updateEnemies:
    ld ix,enemies
    ld b,MAXE
ueLoop:
    push bc
    ld a,(ix+O_STATE)
    cp 1
    jr z,ueWait
    cp 2
    jr z,ueMove
    cp 3
    jp z,ueExpl
    jp ueNext
ueWait:
    ld a,(ix+O_DELAY)
    or a
    jr z,ueStart
    dec (ix+O_DELAY)
    jp ueNext
ueStart:
    ld (ix+O_STATE),2
ueMove:
    ld a,(ix+O_RUN)
    or a
    jr nz,ueStep
    ld l,(ix+O_PATH)
    ld h,(ix+O_PATH+1)
    ld a,(hl)
    or a
    jr z,ueFree
    ld (ix+O_RUN),a
    inc hl
    ld a,(hl)
    ld (ix+O_DX),a
    inc hl
    ld a,(hl)
    ld (ix+O_DY),a
    inc hl
    ld (ix+O_PATH),l
    ld (ix+O_PATH+1),h
ueStep:
    dec (ix+O_RUN)
    ld a,(ix+O_DX)
    call sext
    ld l,(ix+O_X)
    ld h,(ix+O_X+1)
    add hl,de
    ld (ix+O_X),l
    ld (ix+O_X+1),h
    ld a,(ix+O_DY)
    call sext
    ld l,(ix+O_Y)
    ld h,(ix+O_Y+1)
    add hl,de
    ld (ix+O_Y),l
    ld (ix+O_Y+1),h
    ld a,(ix+O_TIMER)
    or a
    jr z,ueAnim
    dec (ix+O_TIMER)
ueAnim:
    ld a,(ix+O_TYPE)
    call typePtr
    push hl
    ld de,T_SHOT
    add hl,de
    ld a,(hl)
    inc hl
    or (hl)
    call nz,enemyFire       ; HL = Typ + T_SHOT + 1
    pop hl
    ld de,T_ANIM
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    call animate
    jp ueNext
ueExpl:
    ld hl,(G_EXPL)
    call animate
    jr nc,ueNext
ueFree:
    ld (ix+O_STATE),0
ueNext:
    ld de,OBJ
    add ix,de
    pop bc
    dec b
    jp nz,ueLoop
    ret

; ---------------------------------------------------------------------
; Gegnerschüsse
; ---------------------------------------------------------------------
; IX = aktiver Gegner, HL = Typ + T_SHOT + 1 (Zeiger ≠ 0). O_DELAY zählt im Zustand 2 die Feuerpause herunter (nur auf dem Bildschirm).
enemyFire:
    ld d,(hl)
    dec hl
    ld e,(hl)
    ex de,hl
    ld a,(ix+O_X+1)
    or (ix+O_Y+1)
    ret nz
    ld (tmpPtr),hl
    ld a,(ix+O_DELAY)
    or a
    jr z,efReload           ; gerade erschienen: erst nach einer vollen Pause
    dec (ix+O_DELAY)
    ret nz
    call efShoot
    ld hl,(tmpPtr)
efReload:
    inc hl                  ; S_RATE
    ld a,(hl)
    ld (ix+O_DELAY),a
    ret

; IX = Gegner, (tmpPtr) = Schussdefinition
efShoot:
    ld iy,(tmpPtr)
    ld a,(iy+S_OFFX)        ; Startposition; außerhalb des Bildschirms → kein Schuss
    call sext
    ld l,(ix+O_X)
    ld h,0
    add hl,de
    ld a,h
    or a
    ret nz
    ld a,l
    ld (tmpX),a
    ld a,(iy+S_OFFY)
    call sext
    ld l,(ix+O_Y)
    ld h,0
    add hl,de
    ld a,h
    or a
    ret nz
    ld a,l
    cp 192
    ret nc
    ld (tmpY),a
    ld a,(iy+S_PATTERN)
    cp 1
    jr nz,efAim
    ld a,(orient)           ; gerade: gegen die Scrollrichtung (H nach links, V nach unten)
    or a
    ld a,8
    jr z,spawnBullet
    ld a,4
    jr spawnBullet
efAim:
    ld b,a
    push bc
    call aimDir
    pop bc
    ld c,a
    ld a,b
    cp 3
    ld a,c
    jr nz,spawnBullet       ; gezielt: ein Schuss
    push bc                 ; Fächer: drei Schüsse im Abstand von 22,5°
    call spawnBullet
    pop bc
    ld a,c
    dec a
    and 15
    push bc
    call spawnBullet
    pop bc
    ld a,c
    inc a
    and 15
    ; weiter in spawnBullet

; A = Richtung 0..15, IY = Schussdefinition, Start tmpX/tmpY. Pool voll → Schuss entfällt.
spawnBullet:
    ld c,a
    ld hl,bullets
    ld de,OBJ
    ld b,MAXB
sbFind:
    ld a,(hl)
    or a
    jr z,sbFound
    add hl,de
    djnz sbFind
    ret
sbFound:
    push ix
    push hl
    pop ix
    ld (ix+O_STATE),2
    ld a,(tmpX)
    ld (ix+O_X),a
    ld a,(tmpY)
    ld (ix+O_Y),a
    xor a
    ld (ix+O_X+1),a
    ld (ix+O_Y+1),a
    ld (ix+O_ATICK),a
    ld (ix+O_AFRAME),a
    ld a,$80                ; halber Pixel: symmetrisch gerundet
    ld (ix+B_XF),a
    ld (ix+B_YF),a
    push iy
    pop hl
    ld (ix+B_DEF),l
    ld (ix+B_DEF+1),h
    ld de,S_VEL
    add hl,de
    ld a,c
    add a,a
    add a,a
    ld e,a
    ld d,0
    add hl,de
    ld a,(hl)
    ld (ix+B_VX),a
    inc hl
    ld a,(hl)
    ld (ix+B_VX+1),a
    inc hl
    ld a,(hl)
    ld (ix+B_VY),a
    inc hl
    ld a,(hl)
    ld (ix+B_VY+1),a
    pop ix
    ld hl,bulCount
    inc (hl)
    ret

; IY = Schussdefinition, Schuss bei tmpX/tmpY → A = Richtung 0..15 zur Spieler-Hitbox (Oktant über dx/dy)
aimDir:
    ld a,(player+O_X)
    ld b,a
    ld a,(tmpX)
    ld c,a
    ld a,(iy+S_AIMX)
    call aimDelta
    push hl
    ld a,(player+O_Y)
    ld b,a
    ld a,(tmpY)
    ld c,a
    ld a,(iy+S_AIMY)
    call aimDelta           ; HL = dy
    pop de                  ; DE = dx
    ld c,0                  ; Bit 0: dx < 0, Bit 1: dy < 0
    bit 7,d
    jr z,adXPos
    inc c
    xor a
    sub e
    ld e,a
    sbc a,a
    sub d
    ld d,a
adXPos:
    bit 7,h
    jr z,adScale
    set 1,c
    xor a
    sub l
    ld l,a
    sbc a,a
    sub h
    ld h,a
adScale:                    ; beide Beträge auf 8 Bit bringen
    ld a,d
    or h
    jr z,adCmp
    srl d
    rr e
    srl h
    rr l
    jr adScale
adCmp:                      ; E = |dx|, L = |dy|
    push bc
    ld a,l
    cp e
    jr c,adFlat
    jr z,adFlat
    ld a,e                  ; steil: von der y-Achse aus messen
    ld e,l
    ld l,a
    call octK
    neg
    add a,4
    jr adQuad
adFlat:
    call octK
adQuad:                     ; A = Schritte von der x-Achse (0..4) → Quadrant
    pop bc
    ld b,a
    ld a,c
    or a
    ld a,b
    ret z                   ; rechts unten: k
    dec c
    jr nz,adQ2
    ld a,8                  ; links unten: 8 - k
    sub b
    ret
adQ2:
    dec c
    jr nz,adQ3
    ld a,16                 ; rechts oben: 16 - k
    sub b
    and 15
    ret
adQ3:
    ld a,8                  ; links oben: 8 + k
    add a,b
    ret

aimDelta:                   ; HL = B - C + sext(A)
    call sext
    ld l,b
    ld h,0
    add hl,de
    ld e,c
    ld d,0
    or a
    sbc hl,de
    ret

; E = größere, L = kleinere Komponente → A = 0 (< 11,25°: klein×5 < groß), 1 (< 33,75°: klein×3 < groß×2), sonst 2
octK:
    ld h,0
    ld d,0
    ld b,h
    ld c,l
    add hl,hl
    add hl,hl
    add hl,bc
    or a
    sbc hl,de
    ld a,0
    ret c
    ld h,b
    ld l,c
    add hl,hl
    add hl,bc
    ex de,hl
    add hl,hl
    ex de,hl
    or a
    sbc hl,de
    ld a,1
    ret c
    inc a
    ret

; shortcut: Gegnerschüsse fliegen durch tödliche Pinsel; ausbauen, wenn Level mit Wänden das brauchen
updateBullets:
    ld a,(bulCount)
    or a
    ret z
    ld hl,bullets
ubLoop:
    ld a,(hl)
    or a
    call nz,ubMove
    ld a,l
    add a,OBJ
    ld l,a
    jr nz,ubLoop            ; Low-Byte läuft nach 16 Schüssen auf 0
    ret
ubMove:                     ; HL = aktiver Schuss (bleibt erhalten)
    push hl
    push hl
    pop ix
    ld l,(ix+B_XF)
    ld h,(ix+O_X)
    ld e,(ix+B_VX)
    ld d,(ix+B_VX+1)
    call bulletStep
    jr c,ubFree
    ld (ix+B_XF),l
    ld (ix+O_X),h
    ld l,(ix+B_YF)
    ld h,(ix+O_Y)
    ld e,(ix+B_VY)
    ld d,(ix+B_VY+1)
    call bulletStep
    jr c,ubFree
    ld a,h
    cp 192
    jr nc,ubFree
    ld (ix+B_YF),l
    ld (ix+O_Y),h
    ld l,(ix+B_DEF)
    ld h,(ix+B_DEF+1)
    inc hl
    inc hl                  ; S_ANIM
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    call animate
    pop hl
    ret
ubFree:
    ld (ix+O_STATE),0
    ld hl,bulCount
    dec (hl)
    pop hl
    ret

; HL = Position 8.8, DE = Tempo 8.8 mit Vorzeichen → HL += DE, Carry = Bildschirm verlassen
bulletStep:
    bit 7,d
    jr nz,bstNeg
    add hl,de
    ret                     ; Übertrag = rechts/unten hinaus
bstNeg:
    add hl,de
    ccf
    ret                     ; kein Übertrag = links/oben hinaus


; ---------------------------------------------------------------------
; Kollision
; ---------------------------------------------------------------------
; A = Pos a, B = Pos b, C = Größe a, D = Größe b → Carry bei Überlappung
ovl1:
    sub b
    jr c,ovlNeg
    cp d
    ret
ovlNeg:
    db $ED,$44              ; neg
    cp c
    ret

; IX = Gegner → hbX..hbH (absolute Hitbox), Carry = nicht kollidierbar
enemyBox:
    ld a,(ix+O_STATE)
    cp 2
    jr nz,ebNo
    ld a,(ix+O_X+1)
    or (ix+O_Y+1)
    jr nz,ebNo
    ld a,(ix+O_TYPE)
    call typePtr
    inc hl
    ld a,(ix+O_X)
    add a,(hl)
    ld (hbX),a
    inc hl
    ld a,(ix+O_Y)
    add a,(hl)
    ld (hbY),a
    inc hl
    ld a,(hl)
    ld (hbW),a
    inc hl
    ld a,(hl)
    ld (hbH),a
    or a
    ret
ebNo:
    scf
    ret

; Vergleicht hbX.. mit shX.. → Carry bei Treffer
boxHit:
    ld a,(shW)
    ld c,a
    ld a,(hbW)
    ld d,a
    ld a,(hbX)
    ld b,a
    ld a,(shX)
    call ovl1
    ret nc
    ld a,(shH)
    ld c,a
    ld a,(hbH)
    ld d,a
    ld a,(hbY)
    ld b,a
    ld a,(shY)
    jp ovl1

collide:
    ld iy,(G_PLAYER)
    ld ix,enemies
    ld b,MAXE
coLoop:
    push bc
    call enemyBox
    jp c,coNext
    ; gegen Spielerschüsse
    ld hl,shots
    ld b,MAXS
coShot:
    ld a,(hl)
    or a
    jr z,coShotNext
    push hl
    inc hl
    inc hl
    ld a,(hl)
    add a,(iy+P_SHBX)
    ld (shX),a
    inc hl
    inc hl
    ld a,(hl)
    add a,(iy+P_SHBY)
    ld (shY),a
    ld a,(iy+P_SHBW)
    ld (shW),a
    ld a,(iy+P_SHBH)
    ld (shH),a
    push bc
    call boxHit
    pop bc
    pop hl
    jr nc,coShotNext
    ld (hl),0               ; Schuss weg
    ld (ix+O_TIMER),6       ; Aufblitzen
    dec (ix+O_HP)
    jr nz,coNext
    ld (ix+O_STATE),3       ; Explosion
    ld (ix+O_ATICK),0
    ld (ix+O_AFRAME),0
    ld a,(G_SND_EXPL)
    call playSfx
    jr coNext
coShotNext:
    ld de,OBJ
    add hl,de
    djnz coShot
    ; gegen Spieler
    ld a,(player+O_TIMER)
    or a
    jr nz,coNext
    call playerBox
    call boxHit
    jr nc,coNext
    call playerHit
coNext:
    ld de,OBJ
    add ix,de
    pop bc
    dec b
    jp nz,coLoop
    ret

; IY = Spielerdefinition → shX..shH (absolute Spieler-Hitbox)
playerBox:
    ld a,(player+O_X)
    add a,(iy+P_HBX)
    ld (shX),a
    ld a,(player+O_Y)
    add a,(iy+P_HBY)
    ld (shY),a
    ld a,(iy+P_HBW)
    ld (shW),a
    ld a,(iy+P_HBH)
    ld (shH),a
    ret

; Gegnerschüsse gegen den Spieler (dieselbe Box-Routine wie die Gegnerkörper)
bulletCollide:
    ld a,(bulCount)
    or a
    ret z
    ld a,(player+O_TIMER)   ; unverwundbar → kein Treffer
    or a
    ret nz
    ld iy,(G_PLAYER)
    call playerBox
    ld hl,bullets
bkLoop:
    ld a,(hl)
    or a
    jr z,bkNext
    push hl
    push hl
    pop ix
    ld l,(ix+B_DEF)
    ld h,(ix+B_DEF+1)
    ld de,S_HBX
    add hl,de
    ld a,(ix+O_X)
    add a,(hl)
    ld (hbX),a
    inc hl
    ld a,(ix+O_Y)
    add a,(hl)
    ld (hbY),a
    inc hl
    ld a,(hl)
    ld (hbW),a
    inc hl
    ld a,(hl)
    ld (hbH),a
    call boxHit
    pop hl
    jr nc,bkNext
    ld (hl),0
    ld hl,bulCount
    dec (hl)
    jp playerHit            ; ein Treffer pro Frame, danach ist der Spieler unverwundbar
bkNext:
    ld a,l
    add a,OBJ
    ld l,a
    jr nz,bkLoop
    ret

; ---------------------------------------------------------------------
; Kollision mit dem Hintergrund (Pinsel mit „tödlich“)
; ---------------------------------------------------------------------
; B = Bildschirm-X, C = Bildschirm-Y → Carry, wenn dort ein tödlicher Pinsel liegt
solidAt:
    ld a,c
    cp 192
    jp nc,saNo
    ld a,(orient)
    or a
    jr nz,saV
    ld hl,(camPos)          ; horizontal: Spalte = (Kamera + x) / 16
    ld e,b
    ld d,0
    add hl,de
    srl h
    rr l
    srl h
    rr l
    srl h
    rr l
    srl h
    rr l
    ld de,(levelLen)
    push hl
    or a
    sbc hl,de
    pop hl
    jr nc,saNo
    add hl,hl
    add hl,hl
    ld d,h
    ld e,l
    add hl,hl
    add hl,de               ; Spalte * 12
    ld a,c
    rrca
    rrca
    rrca
    rrca
    and $0F                 ; + y / 16
    ld e,a
    ld d,0
    add hl,de
    jr saLook
saV:
    ld a,191                ; vertikal: Zeile = (Kamera + 191 - y) / 16
    sub c
    ld e,a
    ld d,0
    ld hl,(camPos)
    add hl,de
    srl h
    rr l
    srl h
    rr l
    srl h
    rr l
    srl h
    rr l
    ld de,(levelLen)
    push hl
    or a
    sbc hl,de
    pop hl
    jr nc,saNo
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl               ; Zeile * 16
    ld a,b
    rrca
    rrca
    rrca
    rrca
    and $0F                 ; + x / 16
    ld e,a
    ld d,0
    add hl,de
saLook:
    ld de,(mapBase)
    add hl,de
    ld l,(hl)
    ld h,0
    ld de,(solidBase)
    add hl,de
    ld a,(hl)
    or a
    ret z
    scf
    ret
saNo:
    or a
    ret

bgCollide:
    ld iy,(G_PLAYER)
    ld a,(player+O_TIMER)   ; unverwundbar → kein Treffer
    or a
    jr nz,bcShots
    ld a,(player+O_X)       ; 4 Ecken der Spieler-Hitbox prüfen
    add a,(iy+P_HBX)
    ld b,a
    ld a,(player+O_Y)
    add a,(iy+P_HBY)
    ld c,a
    call solidAt
    jr c,bcHit
    ld a,b
    add a,(iy+P_HBW)
    dec a
    ld b,a
    call solidAt
    jr c,bcHit
    ld a,c
    add a,(iy+P_HBH)
    dec a
    ld c,a
    call solidAt
    jr c,bcHit
    ld a,b
    sub (iy+P_HBW)
    inc a
    ld b,a
    call solidAt
    jr nc,bcShots
bcHit:
    call playerHit
bcShots:
    ld ix,shots             ; Schüsse verschwinden in tödlichen Pinseln (Mitte der Hitbox)
    ld a,MAXS
bcLoop:
    push af
    ld a,(ix+O_STATE)
    or a
    jr z,bcNext
    ld a,(iy+P_SHBW)
    srl a
    add a,(iy+P_SHBX)
    add a,(ix+O_X)
    ld b,a
    ld a,(iy+P_SHBH)
    srl a
    add a,(iy+P_SHBY)
    add a,(ix+O_Y)
    ld c,a
    call solidAt
    jr nc,bcNext
    ld (ix+O_STATE),0
bcNext:
    ld de,OBJ
    add ix,de
    pop af
    dec a
    jr nz,bcLoop
    ret

playerHit:
    ld a,(G_SND_HIT)
    call playSfx
    ld a,120
    ld (player+O_TIMER),a
    ld a,(G_INVINC)         ; unverwundbar: blinken, aber kein Leben weg
    or a
    ret nz
    ld a,(lives)
    dec a
    ld (lives),a
    ret nz
    ; Game Over → Level neu starten
    jp startLevel

checkLevelEnd:
    ld hl,(camPos)
    ld de,(camMax)
    or a
    sbc hl,de
    ret c
    call anyEnemy           ; noch Gegner aktiv?
    jr z,cleFree
    xor a
    ld (endTimer),a
    ret
cleFree:
    ld a,(endTimer)
    inc a
    ld (endTimer),a
    cp 120
    ret c
    ; nächstes Level
    ld a,(G_LEVELS)
    ld b,a
    ld a,(levelIdx)
    inc a
    cp b
    jr c,cleSet
    xor a
cleSet:
    ld (levelIdx),a
    ld hl,0                 ; Checkpoint gilt nur im eigenen Level
    ld (ckEv),hl
    jp startLevel

; ---------------------------------------------------------------------
; Sprite-Attributtabelle aufbauen
; ---------------------------------------------------------------------
buildSat:
    xor a
    ld (sprCount),a
    ld iy,(G_PLAYER)
    ; Spieler (blinkt bei Unverwundbarkeit)
    ld ix,player
    ld a,(ix+O_TIMER)
    and 4
    jr nz,bsShots
    ld l,(iy+P_ANIM)
    ld h,(iy+P_ANIM+1)
    call curFrame
    call drawMeta
bsShots:
    ld ix,shots
    ld b,MAXS
bsShotLoop:
    push bc
    ld a,(ix+O_STATE)
    or a
    jr z,bsShotNext
    ld l,(iy+P_SANIM)
    ld h,(iy+P_SANIM+1)
    call curFrame
    call drawMeta
bsShotNext:
    ld de,OBJ
    add ix,de
    pop bc
    djnz bsShotLoop
    ; Gegnerschüsse vor den Gegnern (unsichtbare Schüsse wären unfair), Start rotiert: zu viele in einer Zeile flackern
    ld a,(bulCount)
    or a
    jr z,bsBulDone
    ld a,(frame)
    add a,a
    add a,a
    add a,a
    add a,a
    ld l,a                  ; (frame mod 16) × 16
    ld h,bullets/256
    ld b,MAXB
bsBulLoop:
    ld a,(hl)
    or a
    jr z,bsBulNext
    push bc
    push hl
    push hl
    pop ix
    ld l,(ix+B_DEF)
    ld h,(ix+B_DEF+1)
    inc hl
    inc hl                  ; S_ANIM
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    call curFrame
    call drawMeta
    pop hl
    pop bc
bsBulNext:
    ld a,l
    add a,OBJ
    ld l,a
    djnz bsBulLoop
bsBulDone:
    ; Gegner mit rotierender Startposition (Flackern statt Verschlucken)
    ld a,(rot)
    inc a
    cp MAXE
    jr c,bsRot
    xor a
bsRot:
    ld (rot),a
    ld c,a
    ld b,MAXE
bsEnemyLoop:
    push bc
    ld l,c
    ld h,0
    add hl,hl
    add hl,hl
    add hl,hl
    add hl,hl
    ld de,enemies
    add hl,de
    push hl
    pop ix
    call drawEnemy
    pop bc
    ld a,c
    inc a
    cp MAXE
    jr c,bsNoWrap
    xor a
bsNoWrap:
    ld c,a
    djnz bsEnemyLoop
    ; Terminator
    ld a,(sprCount)
    cp 64
    ret z
    ld l,a
    ld h,satY/256
    ld (hl),$D0
    ret

drawEnemy:
    ld a,(ix+O_STATE)
    cp 2
    jr z,deAlive
    cp 3
    ret nz
    ld hl,(G_EXPL)
    jr deDraw
deAlive:
    ld a,(ix+O_TIMER)
    and 2
    ret nz
    ld a,(ix+O_TYPE)
    call typePtr
    ld de,T_ANIM
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
deDraw:
    call curFrame
    jp drawMeta

; HL = Metasprite, IX = Objekt
drawMeta:
    ld b,(hl)
    inc hl
    ld a,b
    or a
    ret z
    exx                     ; Schattenregister je Objekt: BC' = X, DE' = Y + 16
    ld c,(ix+O_X)
    ld b,(ix+O_X+1)
    ld l,(ix+O_Y)
    ld h,(ix+O_Y+1)
    ld de,16
    add hl,de
    ex de,hl
    exx
dmPart:
    ld a,(sprCount)
    cp 64
    ret z
    ld a,(hl)               ; dy
    inc hl
    exx
    ld l,a
    add a,a
    sbc a,a
    ld h,a
    add hl,de               ; Y + dy + 16
    ld a,h
    or a
    jr nz,dmRejY
    ld a,l
    cp 208
    jr nc,dmRejY
    sub 17
    exx
    ld c,a                  ; SAT-Y
    ld a,(hl)               ; dx
    inc hl
    exx
    ld l,a
    add a,a
    sbc a,a
    ld h,a
    add hl,bc               ; X + dx
    ld a,h
    or a
    ld a,l
    exx
    jr nz,dmRejX
    ld d,a                  ; X
    ld e,(hl)               ; Tile
    inc hl
    push hl
    ld a,(sprCount)
    ld l,a
    ld h,satY/256
    ld (hl),c
    add a,a
    add a,satXT&255
    ld l,a
    ld (hl),d
    inc hl
    ld (hl),e
    ld hl,sprCount
    inc (hl)
    pop hl
    djnz dmPart
    ret
dmRejY:
    exx
    inc hl
    inc hl
    djnz dmPart
    ret
dmRejX:
    inc hl
    djnz dmPart
    ret

; ---------------------------------------------------------------------
; Sound (PSG): Musik-Sequenzer + ein Soundeffekt, der einen Kanal übernimmt
; ---------------------------------------------------------------------
soundUpdate:
    call musicUpdate
    jp sfxUpdate

; A = Songindex oder $FF (Stille)
musicStart:
    ld (curSong),a
    ld b,a
    ld a,$9F
    out (PSG),a
    ld a,$BF
    out (PSG),a
    ld a,$DF
    out (PSG),a
    ld a,$FF
    out (PSG),a
    ld hl,chState
    ld de,chState+1
    ld (hl),0
    push bc
    ld bc,15
    ldir
    pop bc
    ld a,15
    ld (chAtt),a
    ld (chAtt+4),a
    ld (chAtt+8),a
    ld (chAtt+12),a
    ld hl,0
    ld (musPtr),hl
    xor a
    ld (sfxLeft),a
    ld a,b
    cp $FF
    ret z
    ld l,a
    ld h,0
    add hl,hl
    ld de,(G_SONGS)
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    ld (musPtr),hl
    ld a,(hl)
    ld (musTempo),a
    dec a
    ld (musTick),a          ; erster Schritt im nächsten Frame
    inc hl
    ld a,(hl)
    ld (musLen),a
    inc hl
    ld ix,chState
    ld de,4
    ld b,4
msHdr:
    ld a,(hl)
    ld (ix+0),a
    inc hl
    ld a,(hl)
    ld (ix+1),a
    inc hl
    add ix,de
    djnz msHdr
    ld (musData),hl
    xor a
    ld (musStep),a
    ret

musicUpdate:
    ld hl,(musPtr)
    ld a,h
    or l
    ret z
    ld a,(musTick)
    inc a
    ld hl,musTempo
    cp (hl)
    jr c,muNoStep
    ld hl,(musData)
    ld a,(musStep)
    ld e,a
    ld d,0
    add hl,de
    ld ix,chState
    ld c,0
muCh:
    ld a,(hl)
    push hl
    call noteEvent
    pop hl
    ld a,(musLen)
    ld e,a
    ld d,0
    add hl,de
    ld de,4
    add ix,de
    inc c
    ld a,c
    cp 4
    jr nz,muCh
    ld a,(musStep)
    inc a
    ld hl,musLen
    cp (hl)
    jr c,muSetStep
    xor a
muSetStep:
    ld (musStep),a
    xor a
muNoStep:
    ld (musTick),a
    ; Abklingen
    ld ix,chState
    ld c,0
muDecay:
    ld a,(ix+1)
    or a
    jr z,muDNext
    ld a,(ix+3)
    cp 15
    jr z,muDNext
    inc (ix+2)
    ld a,(ix+2)
    cp (ix+1)
    jr c,muDNext
    ld (ix+2),0
    inc (ix+3)
    call writeAtt
muDNext:
    ld de,4
    add ix,de
    inc c
    ld a,c
    cp 4
    jr nz,muDecay
    ret

; A = Schrittbyte, C = Kanal, IX = Kanalzustand
noteEvent:
    or a
    ret z                   ; 0 = halten
    cp 1
    jr nz,neOn
    ld (ix+3),15            ; 1 = aus
    jp writeAtt
neOn:
    sub 2
    ld b,a
    ld a,c
    cp 3
    jr z,neNoise
    ld a,b
    add a,a
    ld e,a
    ld d,0
    ld hl,(G_PERIODS)
    add hl,de
    ld e,(hl)
    inc hl
    ld d,(hl)
    call writeTone
    jr neVol
neNoise:
    ld a,b
    call writeNoise
neVol:
    ld a,15
    sub (ix+0)
    ld (ix+3),a
    ld (ix+2),0
    jp writeAtt

; Z, wenn der Effekt Kanal C gerade belegt
owned:
    ld a,(sfxLeft)
    or a
    jr z,ownNo
    ld a,(sfxCh)
    cp c
    ret
ownNo:
    or 1
    ret

writeAtt:                   ; C = Kanal, (IX+3) = Dämpfung
    call owned
    ret z
    ld a,(ix+3)
psgAtt:                     ; A = Dämpfung, C = Kanal
    and 15
    ld b,a
    ld a,c
    rrca
    rrca
    rrca
    or b
    or $90
    out (PSG),a
    ret

writeTone:                  ; C = Kanal, DE = Periode
    call owned
    ret z
psgTone:
    ld a,c
    rrca
    rrca
    rrca
    ld b,a
    ld a,e
    and 15
    or b
    or $80
    out (PSG),a
    ld a,e
    rrca
    rrca
    rrca
    rrca
    and $0F
    ld b,a
    ld a,d
    add a,a
    add a,a
    add a,a
    add a,a
    or b
    and $3F
    out (PSG),a
    ret

writeNoise:                 ; A = Rauschmodus
    ld b,a
    call owned
    ret z
    ld a,b
psgNoise:
    and 7
    or $E0
    out (PSG),a
    ret

; A = Effektindex oder $FF
playSfx:
    cp $FF
    ret z
    push hl
    push de
    push bc
    ld b,a
    ld a,(sfxLeft)
    or a
    call nz,sfxRelease
    ld l,b
    ld h,0
    add hl,hl
    ld de,(G_SFX)
    add hl,de
    ld a,(hl)
    inc hl
    ld h,(hl)
    ld l,a
    ld a,(hl)
    ld (sfxCh),a
    inc hl
    ld a,(hl)
    ld (sfxLeft),a
    inc hl
    ld (sfxPtr),hl
    ld a,$FF
    ld (sfxNoise),a
    pop bc
    pop de
    pop hl
    ret

; Effekt beenden: Kanal bekommt die Lautstärke der Musik zurück
sfxRelease:
    push bc
    push hl
    xor a
    ld (sfxLeft),a
    ld a,(sfxCh)
    ld c,a
    add a,a
    add a,a
    add a,chAtt&255
    ld l,a
    ld h,chAtt/256
    ld a,(hl)
    call psgAtt
    pop hl
    pop bc
    ret

sfxUpdate:
    ld a,(sfxLeft)
    or a
    ret z
    ld a,(sfxCh)
    ld c,a
    ld hl,(sfxPtr)
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld a,(hl)
    inc hl
    ld (sfxPtr),hl
    push af
    ld a,c
    cp 3
    jr z,suNoise
    call psgTone
    jr suAtt
suNoise:
    ld a,(sfxNoise)         ; Rauschmodus nur bei Änderung schreiben (setzt das Rauschregister zurück)
    cp e
    jr z,suAtt
    ld a,e
    ld (sfxNoise),a
    call psgNoise
suAtt:
    pop af
    call psgAtt
    ld hl,sfxLeft
    dec (hl)
    ret nz
    jp sfxRelease

; ---------------------------------------------------------------------
vdpInit:
    db $26,$80              ; Mode 4, linke Spalte maskieren
    db $A2,$81              ; Display aus, VBlank-IRQ, 8x16
    db $FF,$82              ; Name Table $3800
    db $FF,$83
    db $FF,$84
    db $FF,$85              ; SAT $3F00
    db $FF,$86              ; Sprite-Tiles $2000
    db $00,$87              ; Backdrop = Sprite-Farbe 0
    db $00,$88
    db $00,$89
    db $FF,$8A

emptyMap:
    ds 16,0

engineEnd:
