import { useEffect, useRef, useState } from 'react';
import { BTN, SMS } from '@sms/emu';
import { runEmu } from '../audio';

const KEYS: Record<string, number> = {
  ArrowUp: BTN.up, ArrowDown: BTN.down, ArrowLeft: BTN.left, ArrowRight: BTN.right,
  KeyW: BTN.up, KeyS: BTN.down, KeyA: BTN.left, KeyD: BTN.right,
  KeyY: BTN.b1, KeyZ: BTN.b1, KeyJ: BTN.b1, Space: BTN.b1,
  KeyX: BTN.b2, KeyK: BTN.b2,
};

/** Eingebetteter Emulator: spielt das erzeugte ROM. */
export function PlayModal({ rom, title, onClose }: { rom: Uint8Array; title: string; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(3);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const sms = new SMS(rom);
    const ctx = ref.current!.getContext('2d')!;
    const img = new ImageData(new Uint8ClampedArray(sms.vdp.frame.buffer), 256, 192);
    let fpsT = performance.now(), f0 = 0;
    const stop = runEmu(sms, () => {
      ctx.putImageData(img, 0, 0);
      const now = performance.now();
      if (now - fpsT > 1000) { setFps(sms.frameCount - f0); f0 = sms.frameCount; fpsT = now; }
    });

    const gpPoll = setInterval(() => {
      const gp = navigator.getGamepads?.()[0];
      if (!gp) return;
      let b = 0;
      if (gp.axes[1] < -0.5 || gp.buttons[12]?.pressed) b |= BTN.up;
      if (gp.axes[1] > 0.5 || gp.buttons[13]?.pressed) b |= BTN.down;
      if (gp.axes[0] < -0.5 || gp.buttons[14]?.pressed) b |= BTN.left;
      if (gp.axes[0] > 0.5 || gp.buttons[15]?.pressed) b |= BTN.right;
      if (gp.buttons[0]?.pressed) b |= BTN.b1;
      if (gp.buttons[1]?.pressed) b |= BTN.b2;
      sms.buttons = (sms.buttons & 0) | b | keyBits;
    }, 16);

    let keyBits = 0;
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { onClose(); return; }
      if (e.code === 'KeyP' || e.code === 'Enter') { sms.pause(); return; }
      const b = KEYS[e.code];
      if (b) { keyBits |= b; sms.buttons |= b; e.preventDefault(); }
    };
    const ku = (e: KeyboardEvent) => {
      const b = KEYS[e.code];
      if (b) { keyBits &= ~b; sms.buttons &= ~b; e.preventDefault(); }
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      stop();
      clearInterval(gpPoll);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [rom]);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>▶ {title}</b>
          <span className="hint">Pfeile/WASD bewegen · Z/Y/Leertaste feuern · P Pause · Esc schließen · {fps} fps</span>
          <select value={scale} onChange={(e) => setScale(+e.target.value)}>{[2, 3, 4].map((s) => <option key={s} value={s}>{s}×</option>)}</select>
          <button onClick={onClose}>Schließen</button>
        </div>
        <canvas ref={ref} width={256} height={192} style={{ width: 256 * scale, height: 192 * scale, imageRendering: 'pixelated' }} />
      </div>
    </div>
  );
}
