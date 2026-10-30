'use client';

import { useEffect, useRef, useState } from 'react';
import { Pointer } from 'lucide-react';

const storageKey = 'oir-race-day-revealed';
const brush = 26;
// Scratching is manual; this only sweeps away the last specks once nearly everything is cleared.
const revealAt = 0.85;

/**
 * Covers its content with a scratch-off layer that visitors clear by hand (mouse or touch).
 * Enter/Space reveals too, and the content stays readable to screen readers throughout.
 * Once revealed, the browser remembers it so returning visitors aren't asked again.
 */
export function ScratchReveal({ children, hint }: { children: React.ReactNode; hint: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'covered' | 'scratching' | 'revealed'>('covered');
  // Drives the attention animations, which stop as soon as someone starts scratching.
  const [touched, setTouched] = useState(false);
  const scratched = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);

  const reveal = () => {
    setState('revealed');
    // A scratch that keeps going past the reveal would start highlighting the text underneath.
    window.getSelection()?.removeAllRanges();
    try { localStorage.setItem(storageKey, '1'); } catch {}
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) { setState('revealed'); return; }
    } catch {}
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) { setState('revealed'); return; }

    const paint = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#101613';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(217, 250, 53, .12)';
      ctx.lineWidth = 6;
      for (let x = -height; x < width; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x + height, 0);
        ctx.stroke();
      }
      ctx.fillStyle = '#d9fa35';
      ctx.font = `800 ${width < 500 ? 13 : 16}px Inter, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Sits above centre to leave room for the animated hand below it.
      ctx.fillText(hint, width / 2, height / 2 - 14);
    };

    paint();
    setState('scratching');
    // Web fonts and wrapping can change the size after load; repaint while untouched so the cover fits.
    const observer = new ResizeObserver(() => { if (!scratched.current) paint(); });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [hint]);

  const scratch = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (!scratched.current) setTouched(true);
    scratched.current = true;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineWidth = brush * 2;
    ctx.beginPath();
    ctx.moveTo(last.current?.x ?? point.x, last.current?.y ?? point.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    last.current = point;

    // Sampling every few moves keeps the cleared-area check cheap.
    if (++moves.current % 6) return;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 24) { total++; if (data[i] === 0) clear++; }
    if (clear / total >= revealAt) reveal();
  };

  return (
    <div className={`scratch ${state}${touched ? ' touched' : ''}`}>
      <div className="scratchValue">{children}</div>
      {state === 'scratching' && !touched && <span className="scratchHand" aria-hidden="true"><Pointer size={22} /></span>}
      <canvas
        ref={canvasRef}
        role="button"
        tabIndex={state === 'revealed' ? -1 : 0}
        aria-label="Reveal race day"
        aria-hidden={state === 'revealed'}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); last.current = null; scratch(event); }}
        onPointerMove={(event) => { if (event.buttons || event.pointerType !== 'mouse') scratch(event); }}
        onPointerUp={() => { last.current = null; }}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); reveal(); } }}
      />
    </div>
  );
}
