/* Nocta — whatever sits behind an open modal is inert: no clicks, hover,
 * keyboard focus or text selection reach it (the browser's `inert`). React 18
 * doesn't pass `inert` through as a prop, so it's set on the element.
 * `display: contents` keeps the wrapper out of the layout. */
import { useLayoutEffect, useRef } from 'react';

export function Inert({ when, children, className, style }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.inert = Boolean(when);
  }, [when]);
  return (
    <div ref={ref} className={className} style={className ? style : { display: 'contents', ...style }}>
      {children}
    </div>
  );
}

/* the page behind a modal doesn't scroll either (desktop: the window) */
export function useScrollLock(locked) {
  useLayoutEffect(() => {
    if (!locked) return undefined;
    const html = document.documentElement;
    const prev = html.style.overflow;
    const gutter = window.innerWidth - html.clientWidth; // no jump as the scrollbar goes
    html.style.overflow = 'hidden';
    if (gutter > 0) html.style.paddingRight = `${gutter}px`;
    return () => {
      html.style.overflow = prev;
      html.style.paddingRight = '';
    };
  }, [locked]);
}
