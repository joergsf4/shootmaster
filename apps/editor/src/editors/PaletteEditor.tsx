import { useState } from 'react';
import { smsToCss } from '@sms/core';
import { useStore, useProject } from '../store';

export function PaletteEditor() {
  const p = useProject();
  const edit = useStore((s) => s.edit);
  const [sel, setSel] = useState<{ pal: 'bg' | 'sprite'; i: number }>({ pal: 'bg', i: 1 });
  const cur = p.palettes[sel.pal][sel.i];

  return (
    <div className="panel">
      <h2>Paletten</h2>
      <p className="hint">Das Master System hat 64 Farben und zwei Paletten mit je 16 Einträgen. Hintergrund-Tiles nutzen die BG-Palette, Sprites die Sprite-Palette. Sprite-Farbe 0 ist transparent.</p>
      {(['bg', 'sprite'] as const).map((pal) => (
        <div key={pal} className="pal-row">
          <h3>{pal === 'bg' ? 'Hintergrund' : 'Sprites'}</h3>
          <div className="swatches">
            {p.palettes[pal].map((c, i) => (
              <div key={i} className={`swatch big ${sel.pal === pal && sel.i === i ? 'sel1' : ''}`}
                style={{ background: pal === 'sprite' && i === 0 ? 'repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/10px 10px' : smsToCss(c) }}
                onClick={() => setSel({ pal, i })}>{i}</div>
            ))}
          </div>
        </div>
      ))}
      <h3>Hardware-Farbe für {sel.pal === 'bg' ? 'BG' : 'Sprite'} {sel.i}</h3>
      <div className="color-grid">
        {Array.from({ length: 64 }, (_, c) => (
          <div key={c} className={`swatch ${c === cur ? 'sel1' : ''}`} style={{ background: smsToCss(c) }} title={`$${c.toString(16).padStart(2, '0')}`}
            onClick={() => edit((d) => { d.palettes[sel.pal][sel.i] = c; })} />
        ))}
      </div>
    </div>
  );
}
