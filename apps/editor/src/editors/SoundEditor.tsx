import { useEffect, useRef, useState } from 'react';
import {
  buildRom, engineBinary, hzToPeriod, noteHz, noteName, NOISE_MODES, NOTE_COUNT, periodTable, sfxFrames,
  type Sfx, type Song,
} from '@sms/core';
import { SMS } from '@sms/emu';
import { uid, useStore, useProject } from '../store';
import { playPsgFrames, runEmu } from '../audio';

const CH_NAMES = ['Ton 1', 'Ton 2', 'Ton 3', 'Rauschen'];
const CH_COLORS = ['#ffcc00', '#4fc3ff', '#ff7ad9', '#7dff8a'];
const engine = engineBinary();
const MUS_STEP = 0x47; // RAM-Adresse $C047 (musStep) in der Engine

export function SoundEditor() {
  const [view, setView] = useState<'music' | 'sfx'>('music');
  return (
    <div>
      <div className="toolbar">
        <button className={view === 'music' ? 'active' : ''} onClick={() => setView('music')}>♫ Musik</button>
        <button data-tour="sfx" className={view === 'sfx' ? 'active' : ''} onClick={() => setView('sfx')}>✦ Soundeffekte</button>
      </div>
      {view === 'music' ? <MusicEditor /> : <SfxEditor />}
    </div>
  );
}

/** Ton eines Kanals kurz vorhören (mit Abklingen wie in der Engine). */
function previewNote(ch: number, value: number, volume: number, decay: number) {
  const frames: number[][] = [];
  const first = ch === 3
    ? [0xe0 | ((value - 2) & 7)]
    : (() => { const p = periodTable()[value - 2]; return [0x80 | (p & 15), p >> 4]; })();
  const reg = ch === 3 ? 0xf0 : 0x90;
  let att = 15 - volume;
  for (let f = 0; f < 24; f++) {
    if (decay && f && f % decay === 0) att = Math.min(15, att + 1);
    frames.push([...(f === 0 ? first : []), reg | att]);
  }
  frames.push([reg | 15]);
  playPsgFrames(frames);
}

function MusicEditor() {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const song = p.songs.find((s) => s.id === sel.song) ?? p.songs[0];
  const si = p.songs.findIndex((s) => s.id === song?.id);
  const [ch, setCh] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const up = (fn: (d: Song) => void, co?: string) => edit((d) => { fn(d.songs[si]); }, co);

  // Abspielen über ein Soundtest-ROM → klingt exakt wie im Spiel
  useEffect(() => {
    if (!playing || !song) return;
    const sms = new SMS(buildRom(engine, p, { soundTest: { song: song.id } }).rom);
    const stop = runEmu(sms, () => setStep((sms.ram[MUS_STEP] + song.length - 1) % song.length));
    return () => { stop(); setStep(-1); };
  }, [playing, song]);

  const newSong = () => {
    const id = uid('song');
    edit((d) => { d.songs.push({ id, name: 'Neuer Song', tempo: 8, length: 32, channels: [12, 12, 12, 10].map((volume, i) => ({ volume, decay: i === 3 ? 1 : 4, steps: new Array(32).fill(0) })) }); });
    select({ song: id });
  };

  if (!song) return <div className="panel"><button onClick={newSong}>+ Song</button></div>;
  const usedIn = p.levels.filter((l) => l.musicId === song.id || l.events.some((e) => e.type === 'music' && e.musicId === song.id)).map((l) => l.name);
  const c = song.channels[ch];

  return (
    <div className="split">
      <div className="panel narrow">
        <h2>Songs</h2>
        <ul className="list">
          {p.songs.map((s) => <li key={s.id} className={s.id === song.id ? 'sel' : ''} onClick={() => select({ song: s.id })}>{s.name}</li>)}
        </ul>
        <div className="toolbar">
          <button onClick={newSong}>+ Neu</button>
          <button onClick={() => { const id = uid('song'); edit((d) => { d.songs.push({ ...JSON.parse(JSON.stringify(song)), id, name: song.name + ' Kopie' }); }); select({ song: id }); }}>Duplizieren</button>
          <button onClick={() => {
            if (usedIn.length && !confirm(`Song wird in ${usedIn.join(', ')} verwendet. Trotzdem löschen?`)) return;
            setPlaying(false);
            edit((d) => { d.songs.splice(si, 1); d.levels.forEach((l) => {
              if (l.musicId === song.id) l.musicId = '';
              l.events.forEach((e) => { if (e.type === 'music' && e.musicId === song.id) e.musicId = ''; });
            }); });
          }}>Löschen</button>
        </div>
        <div className="form">
          <label>Name <input value={song.name} onChange={(e) => up((d) => { d.name = e.target.value; }, 'songname')} /></label>
          <label>Tempo <input type="range" min={3} max={20} value={song.tempo} onChange={(e) => up((d) => { d.tempo = +e.target.value; }, 'tempo')} /> {song.tempo} Frames/Schritt (≈ {Math.round(900 / song.tempo)} BPM)</label>
          <label>Länge <select value={song.length} onChange={(e) => up((d) => {
            d.length = +e.target.value;
            d.channels.forEach((k) => { k.steps = Array.from({ length: d.length }, (_, i) => k.steps[i] ?? 0); });
          })}>{[16, 32, 48, 64, 96, 128].map((n) => <option key={n}>{n}</option>)}</select> Schritte</label>
        </div>
        <p className="hint">{usedIn.length ? `Läuft in: ${usedIn.join(', ')}` : 'Noch keinem Level zugeordnet (im Level-Editor wählbar).'}</p>
        <button className="primary" onClick={() => setPlaying(!playing)}>{playing ? '■ Stopp' : '▶ Abspielen'}</button>
        <h3>Kanal</h3>
        <div className="toolbar">
          {CH_NAMES.map((n, i) => (
            <button key={i} className={ch === i ? 'active' : ''} style={{ borderLeft: `4px solid ${CH_COLORS[i]}` }} onClick={() => setCh(i)}>{n}</button>
          ))}
        </div>
        <div className="form">
          <label>Lautstärke <input type="range" min={0} max={15} value={c.volume} onChange={(e) => up((d) => { d.channels[ch].volume = +e.target.value; }, 'vol')} /> {c.volume}</label>
          <label>Abklingen <input type="range" min={0} max={20} value={c.decay} onChange={(e) => up((d) => { d.channels[ch].decay = +e.target.value; }, 'decay')} /> {c.decay ? `alle ${c.decay} Frames leiser` : 'aus (hält)'}</label>
        </div>
        <p className="hint">Klick setzt/entfernt eine Note · Rechtsklick setzt „Aus“ (✕). Noten klingen bis zur nächsten Note. Ton 3 wird vom Schuss-Effekt kurz übernommen, Rauschen von der Explosion.</p>
      </div>
      <div className="panel">
        <PianoRoll song={song} ch={ch} step={step}
          onToggle={(i, v, off) => {
            const cur = song.channels[ch].steps[i];
            const next = off ? (cur === 1 ? 0 : 1) : cur === v ? 0 : v;
            up((d) => { d.channels[ch].steps[i] = next; });
            if (next >= 2) previewNote(ch, next, c.volume, c.decay);
          }} />
      </div>
    </div>
  );
}

const CW = 18, RH = 12, LABEL = 46;

function PianoRoll({ song, ch, step, onToggle }: { song: Song; ch: number; step: number; onToggle: (i: number, v: number, off: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const noise = ch === 3;
  const rows = noise ? 8 : NOTE_COUNT;
  const W = LABEL + song.length * CW, H = rows * RH;
  // Zeile ↔ Schrittwert (oben = hoch)
  const rowToValue = (r: number) => 2 + (rows - 1 - r);
  const valueToRow = (v: number) => rows - 1 - (v - 2);

  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.fillStyle = '#14141b'; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      const v = rowToValue(r) - 2;
      const black = !noise && [1, 3, 6, 8, 10].includes(v % 12);
      ctx.fillStyle = black ? '#1b1b25' : '#22222e';
      ctx.fillRect(LABEL, r * RH, W - LABEL, RH - 1);
      ctx.fillStyle = noise ? '#9aa' : v % 12 === 0 ? '#fff' : '#889';
      ctx.font = '9px sans-serif';
      ctx.fillText(noise ? NOISE_MODES[v] : noteName(v), 2, r * RH + 9);
    }
    for (let i = 0; i <= song.length; i++) {
      ctx.fillStyle = i % 16 === 0 ? '#556' : i % 4 === 0 ? '#3a3a4c' : '#26262f';
      ctx.fillRect(LABEL + i * CW, 0, 1, H);
    }
    // Noten: andere Tonkanäle blass, aktueller Kanal kräftig
    const drawCh = (c: number, alpha: number) => {
      const steps = song.channels[c].steps;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < song.length; i++) {
        const v = steps[i];
        if (v === 1 && c === ch) { ctx.fillStyle = '#ff5050'; ctx.fillText('✕', LABEL + i * CW + 5, 10); continue; }
        if (v < 2) continue;
        let j = i + 1;
        while (j < song.length && steps[j] === 0) j++;
        ctx.fillStyle = CH_COLORS[c];
        const r = valueToRow(v);
        ctx.fillRect(LABEL + i * CW + 1, r * RH + 1, CW - 2, RH - 3);
        ctx.fillRect(LABEL + i * CW + 1, r * RH + RH / 2 - 1, (j - i) * CW - 2, 2);
      }
      ctx.globalAlpha = 1;
    };
    if (!noise) [0, 1, 2].filter((c) => c !== ch).forEach((c) => drawCh(c, 0.25));
    drawCh(ch, 1);
    if (step >= 0) { ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(LABEL + step * CW, 0, CW, H); }
  });

  const hit = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left - LABEL) / CW), row = Math.floor((e.clientY - r.top) / RH);
    return i >= 0 && i < song.length && row >= 0 && row < rows ? { i, v: rowToValue(row) } : null;
  };

  return (
    <div className="roll-scroll">
      <canvas ref={ref} width={W} height={H}
        onClick={(e) => { const h = hit(e); if (h) onToggle(h.i, h.v, false); }}
        onContextMenu={(e) => { e.preventDefault(); const h = hit(e); if (h) onToggle(h.i, h.v, true); }} />
    </div>
  );
}

function SfxEditor() {
  const p = useProject();
  const { edit, sel, select } = useStore();
  const fx = p.sfx.find((s) => s.id === sel.sfx) ?? p.sfx[0];
  const fi = p.sfx.findIndex((s) => s.id === fx?.id);
  const up = (fn: (d: Sfx) => void, co?: string) => edit((d) => { fn(d.sfx[fi]); }, co);

  const play = (s: Sfx) => {
    const reg = s.noise ? 0xf0 : 0x90;
    const frames = sfxFrames(s).map((f) => [...(s.noise ? [0xe0 | f.value] : [0x80 | (f.value & 15), f.value >> 4]), reg | f.att]);
    playPsgFrames([...frames, [reg | 15]]);
  };
  const newFx = () => {
    const id = uid('sfx');
    edit((d) => { d.sfx.push({ id, name: 'Neuer Effekt', noise: false, frames: 12, startHz: 1000, endHz: 300, noiseMode: 6, volStart: 14, volEnd: 0 }); });
    select({ sfx: id });
  };

  return (
    <div className="split">
      <div className="panel narrow">
        <h2>Soundeffekte</h2>
        <ul className="list">
          {p.sfx.map((s) => <li key={s.id} className={s.id === fx?.id ? 'sel' : ''} onClick={() => { select({ sfx: s.id }); play(s); }}>{s.name} <small>{s.noise ? 'Rauschen' : 'Ton'}</small></li>)}
        </ul>
        <div className="toolbar">
          <button onClick={newFx}>+ Neu</button>
          {fx && <button onClick={() => { const id = uid('sfx'); edit((d) => { d.sfx.push({ ...fx, id, name: fx.name + ' Kopie' }); }); select({ sfx: id }); }}>Duplizieren</button>}
          {fx && <button onClick={() => edit((d) => {
            d.sfx.splice(fi, 1);
            (['shot', 'explosion', 'hit'] as const).forEach((k) => { if (d.sounds[k] === fx.id) d.sounds[k] = ''; });
          })}>Löschen</button>}
        </div>
        <h3>Im Spiel</h3>
        <div className="form">
          {([['shot', 'Schuss'], ['explosion', 'Explosion'], ['hit', 'Spieler getroffen']] as const).map(([k, label]) => (
            <label key={k}>{label}
              <select value={p.sounds[k]} onChange={(e) => edit((d) => { d.sounds[k] = e.target.value; })}>
                <option value="">– still –</option>
                {p.sfx.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
      {fx && (
        <div className="panel">
          <div className="form">
            <label>Name <input value={fx.name} onChange={(e) => up((d) => { d.name = e.target.value; }, 'fxname')} /></label>
            <label>Klang
              <select value={fx.noise ? 'n' : 't'} onChange={(e) => up((d) => { d.noise = e.target.value === 'n'; })}>
                <option value="t">Ton (Kanal 3)</option><option value="n">Rauschen</option>
              </select>
            </label>
            <label>Dauer <input type="range" min={1} max={90} value={fx.frames} onChange={(e) => up((d) => { d.frames = +e.target.value; }, 'frames')} /> {fx.frames} Frames ({(fx.frames / 60).toFixed(2)} s)</label>
            {fx.noise
              ? <label>Rauschart <select value={fx.noiseMode} onChange={(e) => up((d) => { d.noiseMode = +e.target.value; })}>
                  {NOISE_MODES.map((n, i) => <option key={i} value={i}>{n}</option>)}</select></label>
              : <>
                  <HzSlider label="Tonhöhe Start" value={fx.startHz} onChange={(v) => up((d) => { d.startHz = v; }, 'hz1')} />
                  <HzSlider label="Tonhöhe Ende" value={fx.endHz} onChange={(v) => up((d) => { d.endHz = v; }, 'hz2')} />
                </>}
            <label>Lautstärke Start <input type="range" min={0} max={15} value={fx.volStart} onChange={(e) => up((d) => { d.volStart = +e.target.value; }, 'v1')} /> {fx.volStart}</label>
            <label>Lautstärke Ende <input type="range" min={0} max={15} value={fx.volEnd} onChange={(e) => up((d) => { d.volEnd = +e.target.value; }, 'v2')} /> {fx.volEnd}</label>
          </div>
          <button className="primary" onClick={() => play(fx)}>▶ Abspielen</button>
          <SfxCurve fx={fx} />
        </div>
      )}
    </div>
  );
}

/** Logarithmischer Regler 110 Hz … 4 kHz */
function HzSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const lo = Math.log(noteHz(0)), hi = Math.log(4000);
  return (
    <label>{label}
      <input type="range" min={0} max={1000} value={Math.round(((Math.log(Math.max(110, value)) - lo) / (hi - lo)) * 1000)}
        onChange={(e) => onChange(Math.round(Math.exp(lo + ((hi - lo) * +e.target.value) / 1000)))} /> {value} Hz
    </label>
  );
}

/** Verlauf von Tonhöhe (gelb) und Lautstärke (grün) über die Frames */
function SfxCurve({ fx }: { fx: Sfx }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    const W = 480, H = 120;
    ctx.fillStyle = '#14141b'; ctx.fillRect(0, 0, W, H);
    const f = sfxFrames(fx);
    const bw = W / f.length;
    const maxP = Math.log(1023), minP = Math.log(hzToPeriod(4000));
    f.forEach((x, i) => {
      ctx.fillStyle = 'rgba(47,191,113,0.6)';
      const vh = ((15 - x.att) / 15) * H;
      ctx.fillRect(i * bw, H - vh, Math.max(1, bw - 1), vh);
      if (!fx.noise) {
        const y = ((Math.log(x.value) - minP) / (maxP - minP)) * (H - 4);
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(i * bw, y, Math.max(2, bw - 1), 3);
      }
    });
  });
  return <div><small className="hint">Gelb = Tonhöhe, Grün = Lautstärke, je Frame</small><br /><canvas ref={ref} width={480} height={120} className="pixels" /></div>;
}
