/* Nocta — desktop Therapy view. Device + mask + compliance projection +
 * equipment lifecycle + export, arranged as dashboard panels. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { DEVICE, EQUIPMENT, PROJECTION } from '../../data/therapy.js';
import { maskById } from '../../data/account.js';
import { Icon } from '../Icons.jsx';
import { Rich } from '../Rich.jsx';
import { ProgressBar } from '../Charts.jsx';
import { MaskCard } from '../MaskCard.jsx';

function lifeTone(pct) {
  return pct >= 0.8 ? 'alert' : '';
}
function lifeWord(pct) {
  if (pct >= 1) return 'Replace now';
  if (pct >= 0.8) return 'Replace soon';
  return 'In good shape';
}

export function DesktopTherapy() {
  const [exported, setExported] = useState(false);
  const { maskId } = useStore();
  const cells = DEVICE.cells.map((c) =>
    c.k === 'Mask' ? { k: 'Mask', v: maskById(maskId).name } : c
  );

  /* at-a-glance strip, derived from the same fixtures the cards below use */
  const elapsed = PROJECTION.nights.filter((n) => n !== 'future');
  const metNights = elapsed.filter((n) => n === 'met').length;
  const targetDay = PROJECTION.scale[1].split(' ·')[0]; // 'Day 22 · target'
  const nextDue = EQUIPMENT.reduce((a, e) =>
    e.lifespanDays - e.ageDays < a.lifespanDays - a.ageDays ? e : a
  );
  const dueDays = nextDue.lifespanDays - nextDue.ageDays;

  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">Therapy</h1>
          <div className="dash-sub">Your machine, mask, and the paperwork</div>
        </div>
        <div className="dash-topbar-meta">
          <span className="dash-meta-pill">
            <span className="dash-sync-dot" aria-hidden="true" />
            AirSense 11 · connected
          </span>
          <button
            className={`dash-topbar-action${exported ? ' done' : ''}`}
            onClick={() => setExported(true)}
          >
            <Icon name={exported ? 'check' : 'download'} size={15} />
            {exported ? 'Summary ready' : 'Export for doctor'}
          </button>
        </div>
      </header>

      <div className="dash-statline">
        <div className="stat-mini">
          <div className="sm-k">Compliance nights</div>
          <div className="sm-v">{metNights} of {elapsed.length}</div>
          <div className="sm-sub">4+ hours, this 30-night window</div>
        </div>
        <div className="stat-mini">
          <div className="sm-k">Projected to clear</div>
          <div className="sm-v">{targetDay}</div>
          <div className="sm-sub">at your current pace</div>
        </div>
        <div className="stat-mini">
          <div className="sm-k">Next replacement</div>
          <div className="sm-v">{nextDue.name}</div>
          <div className="sm-sub">due in {dueDays} {dueDays === 1 ? 'day' : 'days'}</div>
        </div>
        <div className="stat-mini">
          <div className="sm-k">Device</div>
          <div className="sm-v">AirSense 11</div>
          <div className="sm-sub">{DEVICE.status} · SleepHQ</div>
        </div>
      </div>

      <div className="therapy-hero">
        <section className="projection">
          <div className="pj-eyebrow">{PROJECTION.eyebrow}</div>
          <h4><Rich text={PROJECTION.headline} /></h4>
          <p>{PROJECTION.body}</p>
          <ProgressBar pct={PROJECTION.progressPct} marker={PROJECTION.targetPct} gradient height={8} />
          <div className="compliance-dots" role="img" aria-label="Compliance status per night, 30 nights">
            {PROJECTION.nights.map((status, i) => (
              <span key={i} className={`compliance-dot ${status}`} />
            ))}
          </div>
          <div className="pj-scale">
            {PROJECTION.scale.map((s, i) => <span key={i}>{s}</span>)}
          </div>
        </section>
      </div>

      <div className="dash-grid dash-grid-therapy">
        <div className="dash-col">
          <div className="dash-head"><h3>Machine &amp; mask</h3></div>
          <section className="device-card">
            <div className="dc-top">
              <span className="dc-dot" />
              <span className="dc-status">{DEVICE.status}</span>
            </div>
            <h3>{DEVICE.name}</h3>
            <div className="dc-sub">{DEVICE.source}</div>
            <div className="dc-grid">
              {cells.map((c) => (
                <div key={c.k} className="dc-cell">
                  <div className="dc-k">{c.k}</div>
                  <div className="dc-v">{c.v}</div>
                </div>
              ))}
            </div>
          </section>

          <MaskCard />
        </div>

        <div className="dash-col">
          <div className="dash-head">
            <h3>Equipment</h3>
            <span className="dash-head-meta">replace on schedule</span>
          </div>
          <div className="equip">
            {EQUIPMENT.map((e) => {
              const pct = e.ageDays / e.lifespanDays;
              const tone = lifeTone(pct);
              return (
                <div className="equip-row" key={e.name}>
                  <div className="er-top">
                    <span className="er-name">{e.name}</span>
                    <span className={`er-age ${tone}`}>
                      {e.ageDays} / {e.lifespanDays} days · {lifeWord(pct)}
                    </span>
                  </div>
                  <ProgressBar pct={pct * 100} color={tone || 'data'} height={6} />
                </div>
              );
            })}
          </div>

          {/* <div className="dash-head"><h3>For your doctor</h3></div>
          <div className="list">
            <button className="list-row" onClick={() => setExported(true)}>
              <div className="lr-main">
                <div className="lr-title">Export 30-night summary</div>
                <div className="lr-sub">
                  {exported
                    ? 'Ready — 30 nights, AHI & leak trends, compliance. No AI commentary.'
                    : 'A clean one-page PDF to bring to your appointment'}
                </div>
              </div>
              <Icon name={exported ? 'check' : 'download'} size={18} />
            </button>
          </div> */}
        </div>
      </div>
    </>
  );
}
