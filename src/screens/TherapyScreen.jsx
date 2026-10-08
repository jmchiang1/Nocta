/* Nocta — Therapy tab. Device status, equipment lifecycle, view-only settings, exports.
 * Compliance leads: it's the one number insurance holds you to. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { DEVICE, EQUIPMENT, machineById, deviceCells } from '../data/therapy.js';
import { NIGHTS_ON_THERAPY } from '../data/history.js';
import { maskById } from '../data/account.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { Icon } from '../components/Icons.jsx';
import { ProgressBar } from '../components/Charts.jsx';
import { MaskCard } from '../components/MaskCard.jsx';
import { ComplianceCard } from '../components/ComplianceCard.jsx';

function lifeTone(pct) {
  if (pct >= 0.8) return 'alert';
  return '';
}
function lifeWord(pct) {
  if (pct >= 1) return 'Replace now';
  if (pct >= 0.8) return 'Replace soon';
  return 'In good shape';
}

export function TherapyScreen() {
  // idle → preparing → ready: a short honest beat instead of an instant checkmark
  const [exportState, setExportState] = useState('idle');
  const { maskId, machineId, openSheet, showToast, syncNonce } = useStore();
  const machine = machineById(machineId);

  function exportSummary() {
    if (exportState !== 'idle') return;
    setExportState('preparing');
    setTimeout(() => {
      setExportState('ready');
      showToast('Doctor summary ready', 'download');
    }, 1400);
  }
  /* device card cells follow both pickers (machine + mask) */
  const cells = deviceCells(machine, maskById(maskId).name);

  return (
    <ScreenFrame title="Therapy">
      <header className="page-head">
        <div>
          <h1>Therapy</h1>
          <div className="sub">Your machine, mask, and the paperwork</div>
        </div>
      </header>

      <ComplianceCard />

      <section className="device-card">
        <div className="dc-top">
          <span className="dc-dot live" aria-hidden="true" />
          <span className="dc-status">{syncNonce > 0 ? 'Synced just now' : DEVICE.status}</span>
        </div>
        <h3>
          {machine.brand} {machine.name}
        </h3>
        <div className="dc-sub">{DEVICE.source}</div>
        <div className="dc-grid">
          {cells.map((c) => (
            <div key={c.k} className="dc-cell">
              <div className="dc-k">{c.k}</div>
              <div className="dc-v">{c.v}</div>
            </div>
          ))}
        </div>
        <button className="row-cta" onClick={() => openSheet('machinePicker')}>
          <span>Change machine</span>
          <Icon name="chevronRight" size={16} />
        </button>
      </section>

      <MaskCard />


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
              <ProgressBar pct={pct * 100} color={tone || 'data'} height={6} />
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <h3>For your doctor</h3>
      </div>
      <div className="list">
        <button
          className={`list-row export-row ${exportState}`}
          onClick={exportSummary}
          aria-busy={exportState === 'preparing'}
        >
          <div className="lr-main">
            <div className="lr-title">Export summary for your doctor</div>
            <div className="lr-sub" key={exportState}>
              {exportState === 'ready'
                ? `Ready. All ${NIGHTS_ON_THERAPY} nights: AHI, leak, hours and compliance. No AI commentary.`
                : exportState === 'preparing'
                  ? 'Preparing your PDF…'
                  : 'A clean one-page PDF to bring to your appointment'}
            </div>
          </div>
          <span className="export-icon" key={`i-${exportState}`}>
            {exportState === 'preparing' ? (
              <span className="mini-spinner" aria-hidden="true" />
            ) : (
              <Icon name={exportState === 'ready' ? 'check' : 'download'} size={18} />
            )}
          </span>
        </button>
      </div>

      <p className="disclaimer">
        The export contains your data only, with no Nocta insights. It is not a medical record.
      </p>
    </ScreenFrame>
  );
}
