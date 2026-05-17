/* Nocta — Therapy tab. Device status, equipment lifecycle, view-only settings, exports. */
import { useState } from 'react';
import { DEVICE, EQUIPMENT, SETTINGS_VIEW, PROJECTION } from '../data/therapy.js';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Rich } from '../components/Rich.jsx';

function lifeTone(pct) {
  if (pct >= 1) return 'alert';
  if (pct >= 0.8) return 'watch';
  return '';
}
function lifeWord(pct) {
  if (pct >= 1) return 'Replace now';
  if (pct >= 0.8) return 'Replace soon';
  return 'In good shape';
}

export function TherapyScreen() {
  const [exported, setExported] = useState(false);

  return (
    <div className="screen">
      <StatusBar />
      <div className="scroll">
        <header className="page-head">
          <div>
            <h1>Therapy</h1>
            <div className="sub">Your machine, mask, and the paperwork</div>
          </div>
        </header>

        <section className="device-card">
          <div className="dc-top">
            <span className="dc-dot" />
            <span className="dc-status">{DEVICE.status}</span>
          </div>
          <h3>{DEVICE.name}</h3>
          <div className="dc-sub">{DEVICE.source}</div>
          <div className="dc-grid">
            {DEVICE.cells.map((c) => (
              <div key={c.k} className="dc-cell">
                <div className="dc-k">{c.k}</div>
                <div className="dc-v">{c.v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="projection">
          <div className="pj-eyebrow">{PROJECTION.eyebrow}</div>
          <h4>
            <Rich text={PROJECTION.headline} />
          </h4>
          <p>{PROJECTION.body}</p>
          <div className="pj-track">
            <span style={{ width: `${PROJECTION.progressPct}%` }} />
          </div>
          <div className="pj-scale">
            {PROJECTION.scale.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </section>

        <div className="section-head">
          <h3>Equipment</h3>
          <span className="meta">replace on schedule</span>
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
                <div className="lifebar">
                  <span className={tone} style={{ width: `${Math.min(100, pct * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="section-head">
          <h3>Prescribed settings</h3>
          <span className="meta">view only</span>
        </div>
        <div className="list">
          {SETTINGS_VIEW.map((s) => (
            <div className="list-row" key={s.k}>
              <div className="lr-icon">
                <Icon name="wind" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">{s.k}</div>
              </div>
              <div className="lr-right">{s.v}</div>
            </div>
          ))}
        </div>
        <p className="disclaimer">
          Pressure settings are set by your doctor. Nocta shows them but never changes them.
        </p>

        <div className="section-head">
          <h3>For your doctor</h3>
        </div>
        <div className="list">
          <button className="list-row" onClick={() => setExported(true)}>
            <div className="lr-icon accent">
              <Icon name="doc" size={17} />
            </div>
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
        </div>

        <p className="disclaimer">
          The export contains your data only — no Nocta insights. It is not a medical record.
        </p>
      </div>
    </div>
  );
}
