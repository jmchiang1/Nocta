/* Nocta — last night's insight, sky-first. Replaces the boxed why-card on
 * Tonight: a short verdict, one line that gives it a reference point (with an
 * info button for Nocta's reasoning), the night drawn as a horizon of breathing
 * events per hour against a dashed "usual" line, then the one action in words.
 *
 * Reads insight.glance (FEATURES.md schema) for the headline + detail line.
 * The horizon reads the night's shared event data (lib/nightSeries nightBins),
 * the same counts the night chart and the episode list use, so they never
 * disagree. */
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './Icons.jsx';
import { Mascot } from './Mascot.jsx';
import { RevealText } from '../lib/motion.jsx';
import { binEvents } from './NightTimeline.jsx';
import { nightBins, clockMin, hourLabel } from '../lib/nightSeries.js';

const STATE_CLASS = {
  anomaly: 'state-anomaly',
  steady: 'state-steady',
  win: 'state-win',
  escalation: 'state-escalation',
  insufficient_data: 'state-insufficient',
};

// steady & insufficient-data nights carry no action (same rule as the old card)
const NO_ACTION = new Set(['steady', 'insufficient_data']);

const PLOT_H = 190;
const TOP = 26; // headroom for the peak label
const BASE = PLOT_H - 10;

/* smooth line through the points: monotone cubic (Fritsch–Carlson), so the
 * curve never overshoots the real values — no dips below zero, no false peaks */
function smooth(pts) {
  const f = (x) => Math.round(x * 10) / 10;
  const n = pts.length;
  if (n < 2) return `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const d = [];
  for (let i = 0; i < n - 1; i += 1) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0] || 1));
  const m = pts.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    return d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  });
  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const k = a * a + b * b;
      if (k > 9) {
        const t = 3 / Math.sqrt(k);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
  }
  let path = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = (pts[i + 1][0] - pts[i][0]) / 3;
    path += `C${f(pts[i][0] + h)} ${f(pts[i][1] + m[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - m[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return path;
}

/* the plot is full-bleed, so draw it at its real pixel width (a stretched
 * viewBox made the draw-in animation stop short of the end) */
function useWidth(fallback) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}

/* the one action, led by a guiding star: Nocta's suggestion is the thing to
 * follow tonight. The first sentence is the instruction; the rest, the reason. */
function GuidingStar({ text }) {
  const m = /^(.+?[.!?])\s+(.+)$/s.exec(text);
  const head = m ? m[1] : text;
  const reason = m ? m[2] : null;
  return (
    <section className="wh-guide" aria-label="Tonight's suggestion">
      <span className="wh-guide-mark" aria-hidden="true">
        <svg className="wh-star" width="28" height="28" viewBox="0 0 24 24">
          <path d="M12 1.5 13.6 10.4 22.5 12 13.6 13.6 12 22.5 10.4 13.6 1.5 12 10.4 10.4Z" />
        </svg>
        <span className="wh-guide-trail" />
      </span>
      <span className="wh-guide-body">
        <span className="wh-guide-label">Tonight</span>
        <span className={`wh-guide-head${head.length > 44 ? ' long' : ''}`}>{head}</span>
        {reason && <span className="wh-guide-reason">{reason}</span>}
      </span>
    </section>
  );
}

export function WhyHorizon({ insight, timeline, session, usual, fixtureId, onWhy, onAsk, onDoctor }) {
  const [plotRef, W] = useWidth(390);
  const state = insight.card_state;
  const glance = insight.glance ?? {};
  const action = !NO_ACTION.has(state) && insight.recommended_action;
  const doctorPath = insight.escalation_flag === 'hard' && onDoctor;

  // breathing events per hour across the night (same binning as the night chart)
  const start = clockMin(session?.start);
  let span = clockMin(session?.end) - start;
  if (!(span > 0)) span = (session?.durationHours ?? 6) * 60;
  const hours = Math.max(2, Math.round(span / 60));
  const bins = fixtureId
    ? nightBins(fixtureId, hours)
    : timeline
      ? binEvents(timeline.events, timeline.eventCount, hours)
      : [];
  // every scored event counts toward AHI, hypopneas included
  const counts = bins.map((b) => b.osa + b.csa + (b.hyp ?? 0));
  const perHour = counts.map((c) => c / (span / 60 / hours));
  const maxRate = Math.max(0, ...perHour);
  const yMax = Math.max(maxRate * 1.15, (usual ?? 0) * 2, 4);
  const y = (rate) => BASE - (BASE - TOP) * (rate / yMax);

  // one point per hour at its centre, held flat out to both edges
  const pts = perHour.map((r, i) => [((i + 0.5) / hours) * W, y(r)]);
  const linePts = pts.length ? [[0, pts[0][1]], ...pts, [W, pts[pts.length - 1][1]]] : [[0, BASE], [W, BASE]];
  const line = smooth(linePts);
  const area = `${line}L${W} ${PLOT_H}L0 ${PLOT_H}Z`;
  const peak = counts.length ? counts.indexOf(Math.max(...counts)) : -1;
  // an unscored night has no peak worth pointing at
  const showPeak = state !== 'insufficient_data' && peak >= 0 && counts[peak] > 0;
  const usualY = usual != null ? y(usual) : null;

  // whole-hour ticks every two hours across the night
  const ticks = [];
  if (start != null) {
    for (let m = Math.ceil(start / 60) * 60; m <= start + span; m += 60) {
      const h24 = (m / 60 + 12) % 24;
      const x = ((m - start) / span) * 100;
      // skip ticks that would be clipped at the screen edges
      if (h24 % 2 === 0 && x > 5 && x < 95) ticks.push({ x, label: hourLabel(m) });
    }
  }

  return (
    <section className={`why-horizon ${STATE_CLASS[state] || 'state-insufficient'}`} aria-label="Last night's insight">
      <div className="wh-head">
        <h2 className="wh-headline">
          <RevealText text={glance.headline ?? insight.headline} />
        </h2>
        {/* Nocta's face is the way in to the Coach for this night */}
        {onAsk && (
          <button className="wh-ask" type="button" onClick={onAsk} aria-label="Ask Nox about last night" title="Ask Nox about last night">
            <Mascot size={38} state="idle" />
          </button>
        )}
      </div>
      {glance.detail && (
        <p className="wh-detail tnum">
          {glance.detail}
          {onWhy && (
            <button className="wh-info" type="button" onClick={onWhy} aria-label="Why Nox thinks this">
              <Icon name="info" size={17} />
            </button>
          )}
        </p>
      )}

      <figure className="wh-figure">
        <div className="wh-plot" ref={plotRef}>
          <svg
            width={W}
            height={PLOT_H}
            viewBox={`0 0 ${W} ${PLOT_H}`}
            role="img"
            aria-label={`Breathing events per hour through the night${showPeak ? `, highest at ${counts[peak]} in one hour` : ''}${usual != null ? `, against your usual ${usual}` : ''}.`}
          >
            <defs>
              <linearGradient id="wh-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: 'var(--data-1)', stopOpacity: 0.5 }} />
                <stop offset="0.6" style={{ stopColor: 'var(--data-deep)', stopOpacity: 0.16 }} />
                <stop offset="1" style={{ stopColor: 'var(--data-deep)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path className="wh-area" d={area} fill="url(#wh-fill)" />
            {usualY != null && <line className="wh-usual" x1="0" x2={W} y1={usualY} y2={usualY} />}
            <path className="wh-line" d={line} pathLength="1" fill="none" />
          </svg>
          {usualY != null && (
            <span className="wh-usual-label tnum" style={{ top: `${usualY}px` }}>
              your usual AHI {usual}
            </span>
          )}
          {showPeak && (
            <>
              <span
                className="wh-peak-dot"
                style={{ left: `${pts[peak][0]}px`, top: `${pts[peak][1]}px` }}
                aria-hidden="true"
              />
              <span
                className="wh-peak-label tnum"
                style={{ left: `${Math.min(W - 52, Math.max(52, pts[peak][0]))}px`, top: `${pts[peak][1]}px` }}
              >
                {counts[peak]} {counts[peak] === 1 ? 'event' : 'events'}
              </span>
            </>
          )}
        </div>
        <figcaption className="wh-ticks tnum" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t.label} style={{ left: `${t.x}%` }}>
              {t.label}
            </span>
          ))}
        </figcaption>
      </figure>

      {action &&
        (doctorPath ? (
          <button className="wh-doctor" type="button" onClick={onDoctor}>
            <span className="wh-doctor-title">Prepare doctor summary</span>
            <span className="wh-doctor-text">{action.action}</span>
            <Icon name="chevronRight" size={18} />
          </button>
        ) : (
          <GuidingStar text={action.action} />
        ))}
    </section>
  );
}
