/* Nocta — motion primitives shared by the mobile shell.
 * Everything here no-ops under prefers-reduced-motion: numbers land on their
 * final value, text appears whole, nothing waits on a timer. */
import { useEffect, useRef, useState, Fragment } from 'react';

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* Animate a number from 0 (or its previous value) to `target`. */
export function useCountUp(target, { duration = 900, delay = 0 } = {}) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }
    const from = fromRef.current;
    let raf;
    let start;
    const tick = (now) => {
      if (start == null) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const v = from + (target - from) * easeOutExpo(t);
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);

  return value;
}

/* Renders a numeric readout that counts up on mount. Accepts a number or a
 * string with a numeric prefix ('2.3×', '5 / 5', '32') — the prefix animates,
 * the suffix stays put. Non-numeric values ('—') render as-is. */
const NUM_PREFIX = /^(-?\d+(?:\.\d+)?)(.*)$/s;

export function CountUp({ value, decimals, duration, delay }) {
  const str = String(value);
  const m = typeof value === 'number' ? [null, String(value), ''] : str.match(NUM_PREFIX);
  const target = m ? parseFloat(m[1]) : 0;
  const places = decimals ?? (m && m[1].includes('.') ? m[1].split('.')[1].length : 0);
  const v = useCountUp(target, { duration, delay });
  if (!m) return str;
  return (
    <>
      {v.toFixed(places)}
      {m[2]}
    </>
  );
}

/* Word-by-word reveal for AI-voiced headlines. Understands the same tiny
 * markdown as <Rich> (**bold**, *italic*) so emphasis survives the split.
 * Each word gets --i for a CSS-driven stagger (see .reveal-word). */
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function RevealText({ text, startIndex = 0 }) {
  if (!text) return null;
  let i = startIndex;
  const parts = String(text).split(TOKEN).filter(Boolean);

  const words = (str, Wrap) =>
    str.split(/(\s+)/).map((w, k) => {
      if (/^\s+$/.test(w)) return w;
      const node = (
        <span className="reveal-word" style={{ '--i': i }} key={`${i}-${k}`}>
          {Wrap ? <Wrap>{w}</Wrap> : w}
        </span>
      );
      i += 1;
      return node;
    });

  return (
    <span className="reveal" aria-label={String(text).replace(/\*/g, '')}>
      <span aria-hidden="true">
        {parts.map((part, p) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <Fragment key={p}>{words(part.slice(2, -2), 'strong')}</Fragment>;
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return <Fragment key={p}>{words(part.slice(1, -1), 'em')}</Fragment>;
          }
          return <Fragment key={p}>{words(part)}</Fragment>;
        })}
      </span>
    </span>
  );
}

/* Streams text in a word at a time, like a model response arriving.
 * Returns the visible slice and whether it's finished. */
export function useStreamedText(full, { wordMs = 28, enabled = true } = {}) {
  const words = useRef([]);
  const [count, setCount] = useState(() => (enabled && !prefersReducedMotion() ? 0 : Infinity));

  useEffect(() => {
    words.current = String(full).split(/(\s+)/);
    if (!enabled || prefersReducedMotion()) {
      setCount(Infinity);
      return undefined;
    }
    setCount(0);
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= words.current.length) {
          clearInterval(id);
          return c;
        }
        return c + 2; // word + its trailing whitespace
      });
    }, wordMs);
    return () => clearInterval(id);
  }, [full, wordMs, enabled]);

  const all = words.current.length ? words.current : String(full).split(/(\s+)/);
  const done = count >= all.length;
  return { text: done ? String(full) : all.slice(0, count).join(''), done };
}
