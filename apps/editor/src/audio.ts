// Ton-Ausgabe für den Emulator und die Vorhör-Funktionen
import { PSG, type SMS } from '@sms/emu';

let shared: AudioContext | undefined;
const ctx = () => (shared ??= new AudioContext());

/** Spielt PCM-Puffer lückenlos hintereinander ab. */
class Stream {
  private next = 0;
  push(s: Float32Array) {
    const c = ctx();
    const now = c.currentTime;
    if (this.next < now + 0.02 || this.next > now + 0.25) this.next = now + 0.05; // Lücke oder Stau → neu ansetzen
    const b = c.createBuffer(1, s.length, c.sampleRate);
    b.copyToChannel(s as Float32Array<ArrayBuffer>, 0);
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(c.destination);
    src.start(this.next);
    this.next += b.duration;
  }
}

/** Lässt den Emulator in Echtzeit laufen (60 Bilder/s, mit Ton). Gibt eine Stopp-Funktion zurück. */
export function runEmu(sms: SMS, onFrame?: () => void): () => void {
  const c = ctx();
  void c.resume();
  const stream = new Stream();
  const perFrame = Math.round(c.sampleRate / 60);
  let raf = 0, last = performance.now(), acc = 0;
  const loop = (now: number) => {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= 1000 / 60) {
      sms.runFrame();
      stream.push(sms.psg.render(perFrame, c.sampleRate));
      acc -= 1000 / 60;
    }
    onFrame?.();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

/** Kurzer Ton direkt über einen PSG (Vorhören beim Notensetzen). writes = PSG-Bytes pro Frame. */
export function playPsgFrames(frames: number[][]) {
  const c = ctx();
  void c.resume();
  const psg = new PSG();
  const perFrame = Math.round(c.sampleRate / 60);
  const out = new Float32Array(perFrame * frames.length);
  frames.forEach((bytes, i) => { bytes.forEach((b) => psg.write(b)); out.set(psg.render(perFrame, c.sampleRate), i * perFrame); });
  new Stream().push(out);
}
