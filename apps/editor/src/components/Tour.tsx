import { useEffect, useState } from 'react';
import { useStore, type Tab } from '../store';
import { isTextEntry } from '../keys';

interface Step { tab?: Tab; sel?: string; title: string; text: string }

// Reihenfolge = Arbeitsablauf: erst ansehen und spielen, dann Grafik → Objekte → Bewegung → Level → Sound → Export
const STEPS: Step[] = [
  { title: 'Willkommen im SMS Shmup Maker', text: 'Hier baust du ein Shoot ’em Up für das Sega Master System und lädst es als echte ROM-Datei herunter. Die Tour zeigt dir alle Werkzeuge. Du kannst nebenbei alles ausprobieren.' },
  { sel: 'header .primary', title: 'Sofort spielen', text: '„▶ Spielen“ baut aus deinem Projekt die ROM und startet sie im eingebauten Emulator. Steuerung: Pfeiltasten, Z/Leertaste feuern, P Pause, R Neustart, Esc schließen.' },
  { sel: '[data-tour="problems"]', title: 'Probleme', text: 'Hier stehen Fehler (✖) und Warnungen (⚠), z. B. eine gelöschte Formation oder zu viele Gegner gleichzeitig. Jede Meldung sagt, was zu tun ist. Klick öffnet die Liste, ein Eintrag springt zur Ursache (im Level bis zum Ereignis), Esc schließt sie. Solange es Fehler gibt, startet „▶ Spielen“ nicht, sondern öffnet diese Liste.' },
  { sel: '.stats', title: 'Hardware-Grenzen im Blick', text: 'Das Master System hat wenig Grafikspeicher: 256 verschiedene 8×8-Kacheln für den Hintergrund und 192 für Sprites. Die Balken zeigen, wie viel belegt ist. Rot heißt: so passt es nicht in die Konsole.' },
  { tab: 'palette', sel: '.color-grid', title: 'Paletten', text: 'Die Konsole kennt 64 Farben. Du hast zwei Paletten mit je 16 Farben: eine für den Hintergrund, eine für Sprites. Erst oben einen Platz wählen, dann hier die Farbe.' },
  { tab: 'tiles', sel: '.mt-list', title: 'Pinsel', text: 'Der Hintergrund wird aus 16×16-Pinseln gemalt. Jeder Pinsel ist ein eigenes Bild – „Duplizieren“ und Details ändern, z. B. Erde mit und ohne Gras.' },
  { tab: 'tiles', sel: '.pixel-editor', title: 'Pinsel bemalen', text: 'Linke und rechte Maustaste malen mit zwei Farben. Rechts siehst du den Pinsel gekachelt. Mit „Tödlich bei Berührung“ wird er zur Wand: Der Spieler verliert dort ein Leben, Schüsse verschwinden.' },
  { tab: 'sprites', sel: '.list', title: 'Sprites', text: 'Schiff, Gegner, Schüsse und Explosionen. „Duplizieren“ kopiert ein Sprite, wenn du nur Details ändern willst.' },
  { tab: 'sprites', sel: '.frames', title: 'Animation', text: '„+ Frame“ kopiert den aktuellen Frame – ideal für kleine Animationen. Rechts läuft die Vorschau in Originalgeschwindigkeit. Achte auf die Anzeige „HW-Sprites/Zeile“: mehr als 8 flackert.' },
  { tab: 'objects', sel: '.form', title: 'Spieler', text: 'Hier legst du fest, welches Sprite der Spieler ist, wie schnell er fliegt, wie oft er schießt und wie groß seine Trefferzone (Hitbox) ist.' },
  { tab: 'objects', sel: '.table', title: 'Gegnertypen', text: 'Jeder Gegnertyp hat ein Sprite, Lebenspunkte, Punkte und eine Hitbox. Darunter wählst du sein Schussmuster (gerade, gezielt, Fächer) mit Feuerpause und Tempo. Wie er sich bewegt, bestimmt die Formation.' },
  { tab: 'formations', sel: '.stage', title: 'Formationen: Flugbahn zeichnen', text: 'Klick setzt Wegpunkte, die Kurve entsteht von selbst. Punkte ziehen = verschieben, Rechtsklick = löschen. Der graue Rand liegt außerhalb des Bildschirms – dort kommen Gegner herein.' },
  { tab: 'formations', sel: '.panel.narrow .form', title: 'Kette oder Block', text: '„Kette“: Gegner folgen einander auf derselben Bahn. „Block“: eine starre Formation wie ein V. Anzahl, Abstand und Tempo per Regler; unter „Pfad“ gibt es Vorlagen und Spiegeln.' },
  { tab: 'formations', sel: '.timeline', title: 'Vorschau', text: 'Play, Zeitlupe und Schieberegler zeigen die Formation in Bewegung. Die Anzeige rechts warnt, wenn zu viele Sprites in einer Bildzeile liegen.' },
  { tab: 'levels', sel: '.level-side .list', title: 'Level', text: 'Jedes Level scrollt horizontal oder vertikal. Neue Level legst du mit „+ Horizontal“ oder „+ Vertikal“ an; die Reihenfolge bestimmt den Spielablauf.' },
  { tab: 'levels', sel: '.level-side .form', title: 'Level-Einstellungen', text: 'Länge (in Feldern zu 16 px), Scrolltempo und Musik des Levels. Darunter steht die Spieldauer mit allen Tempo-Ereignissen.' },
  { tab: 'levels', sel: '.level-side .mt-list', title: 'Pinsel wählen', text: 'Wähle einen Pinsel …' },
  { tab: 'levels', sel: '.level-scroll', title: '… und male das Level', text: 'Linke Maustaste malt, rechte radiert. Oben gibt es Rechteck, Füllen und Pipette. Mausrad scrollt durch das Level; der grüne Rahmen ist der Startbildschirm.' },
  { tab: 'levels', sel: '[data-tour="events"]', title: 'Gegner platzieren', text: 'Mit „Ereignisse“ setzt du Formationen ins Level: Sie starten, wenn der Marker den Bildschirmrand erreicht. Ein angewählter Marker zeigt die Flugbahn, die Leiste ändert dann ihn („Gewählt“), auch seine Position und mit „früher“/„später“ die Reihenfolge an derselben Stelle. Esc hebt die Auswahl auf, Entf löscht. Weitere Typen: Tempo, Musik, Warten und Checkpoint – der Hinweis unter der Leiste erklärt jeden.' },
  { tab: 'levels', sel: '.level-side .primary', title: 'Level testen', text: 'Startet direkt dieses Level im Emulator. „▶ Ab hier“ (Taste P) startet mitten im Level am Rand der aktuellen Ansicht; blasse Ereignisse liegen davor. Danach folgen die übrigen Level. Im Spiel startet R neu, und „Unverwundbar“ hilft beim Feintuning.' },
  { tab: 'sound', sel: '.roll-scroll', title: 'Musik', text: 'Drei Tonkanäle und ein Rauschkanal für Schlagzeug. Klick setzt eine Note (du hörst sie sofort), Rechtsklick setzt „Aus“. „▶ Abspielen“ klingt genau wie im Spiel.' },
  { tab: 'sound', sel: '[data-tour="sfx"]', title: 'Soundeffekte', text: 'Hier baust du Effekte aus Tonhöhenverlauf oder Rauschen und ordnest sie Schuss, Explosion und Treffer zu.' },
  { sel: '[data-tour="export"]', title: 'Fertig: ROM herunterladen', text: 'Die .sms-Datei läuft in Emulatoren wie Emulicious oder auf echter Hardware (z. B. Everdrive). Dein Projekt speichert sich automatisch im Browser – „💾 Projekt“ sichert es zusätzlich als Datei.' },
  { title: 'Viel Spaß!', text: 'Die Tour findest du jederzeit wieder unter „? Tutorial“ oben rechts.' },
];

/** Geführte Tour: wechselt den Tab, hebt das Werkzeug hervor und erklärt es. */
export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const setTab = useStore((s) => s.setTab);
  const step = STEPS[i];

  useEffect(() => { if (step.tab) setTab(step.tab); }, [i]);

  // Ziel-Element verfolgen (taucht nach dem Tabwechsel erst auf, kann scrollen)
  useEffect(() => {
    let first = true;
    const find = () => {
      const el = step.sel ? document.querySelector(step.sel) : null;
      if (el && first) { el.scrollIntoView({ block: 'nearest' }); first = false; }
      setRect(el ? el.getBoundingClientRect() : null);
    };
    find();
    const t = setInterval(find, 150);
    return () => clearInterval(t);
  }, [i]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Pfeile gehören dem Feld (Cursor, Regler, Auswahl), nicht der Tour
      const t = e.target as HTMLInputElement;
      if (isTextEntry(t) || t.tagName === 'SELECT' || t.type === 'range') return;
      if (e.key === 'ArrowRight') setI((n) => Math.min(STEPS.length - 1, n + 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', kd);
    return () => window.removeEventListener('keydown', kd);
  }, [onClose]);

  // Sprechblase unter (oder über) dem Ziel, innerhalb des Fensters
  const BW = 360, pad = 8;
  let style: React.CSSProperties = { left: '50%', top: '40%', transform: 'translate(-50%, -50%)' };
  if (rect) {
    const below = rect.bottom + 180 < window.innerHeight;
    const top = below ? rect.bottom + 12 : Math.max(pad, rect.top - 12 - 170);
    const left = Math.min(window.innerWidth - BW - pad, Math.max(pad, rect.left));
    style = { left, top: Math.min(top, window.innerHeight - 190) };
  }

  return (
    <>
      {rect
        ? <div className="tour-hole" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
        : <div className="tour-dim" />}
      <div className="tour-bubble" style={{ ...style, width: BW }} role="dialog" aria-label={step.title}>
        <small>{i + 1} / {STEPS.length}</small>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="toolbar">
          <button onClick={onClose}>Beenden</button>
          <span className="grow" />
          <button disabled={i === 0} onClick={() => setI(i - 1)}>← Zurück</button>
          {i < STEPS.length - 1
            ? <button className="primary" onClick={() => setI(i + 1)}>Weiter →</button>
            : <button className="primary" onClick={onClose}>Los geht’s</button>}
        </div>
      </div>
    </>
  );
}
