import { MAX_ENEMIES, type Formation, type Point } from './types';

/** Catmull-Rom-Spline durch die Punkte, dicht abgetastet. */
export function sampleSpline(points: Point[], stepsPerSeg = 24): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];
  const p = [points[0], ...points, points[points.length - 1]];
  const out: Point[] = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

/** Position pro Frame bei konstanter Geschwindigkeit (gerundet auf ganze Pixel). */
export function framePositions(points: Point[], speed: number): Point[] {
  const s = sampleSpline(points);
  if (s.length < 2) return s.map((q) => ({ x: Math.round(q.x), y: Math.round(q.y) }));
  const cum = [0];
  for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y));
  const total = cum[cum.length - 1];
  const v = Math.max(0.05, speed);
  const out: Point[] = [];
  let seg = 1;
  for (let d = 0; ; d += v) {
    const dd = Math.min(d, total);
    while (seg < s.length - 1 && cum[seg] < dd) seg++;
    const a = s[seg - 1], b = s[seg];
    const l = cum[seg] - cum[seg - 1];
    const t = l > 0 ? (dd - cum[seg - 1]) / l : 0;
    out.push({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });
    if (d >= total) break;
  }
  return out;
}

/** Pfad als RLE-Deltas: [n, dx, dy]... 0-terminiert. */
export function bakePath(points: Point[], speed: number): { start: Point; bytes: number[]; frames: number } {
  const pos = framePositions(points, speed);
  const start = pos[0] ?? { x: 0, y: 0 };
  const bytes: number[] = [];
  let run = 0, rdx = 0, rdy = 0;
  const flush = () => { if (run > 0) bytes.push(run, rdx & 0xff, rdy & 0xff); run = 0; };
  for (let i = 1; i < pos.length; i++) {
    const dx = pos[i].x - pos[i - 1].x, dy = pos[i].y - pos[i - 1].y;
    if (Math.abs(dx) > 127 || Math.abs(dy) > 127) throw new Error('Pfad zu schnell (> 127 px/Frame)');
    if (run > 0 && dx === rdx && dy === rdy && run < 255) run++;
    else { flush(); run = 1; rdx = dx; rdy = dy; }
  }
  flush();
  bytes.push(0);
  return { start, bytes, frames: pos.length };
}

export interface MemberSpec { delay: number; dx: number; dy: number }

/** Mitglieder einer Formation (Verzögerung + Versatz). */
export function formationMembers(f: Formation): MemberSpec[] {
  const n = Math.max(1, Math.min(MAX_ENEMIES, f.count));
  const out: MemberSpec[] = [];
  for (let i = 0; i < n; i++) {
    if (f.mode === 'chain') out.push({ delay: Math.min(255, i * f.spacing), dx: 0, dy: 0 });
    else {
      const o = f.offsets[i] ?? { x: i * 20, y: 0 };
      out.push({ delay: 0, dx: Math.max(-128, Math.min(127, o.x)), dy: Math.max(-128, Math.min(127, o.y)) });
    }
  }
  return out;
}
