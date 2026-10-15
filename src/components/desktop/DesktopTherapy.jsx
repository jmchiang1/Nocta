/* Nocta — desktop Therapy view. Same order as the mobile screen: compliance
 * leads (it's the one number insurance holds you to), then the machine, the
 * mask and the equipment schedule side by side, then the doctor export. */
import { useStore } from '../../lib/store.jsx';
import { cardDevice, machineName, deviceCells } from '../../data/therapy.js';
import { EquipmentList } from '../EquipmentList.jsx';
import { openDoctorReport } from '../../lib/doctorReport.js';
import { deviceStatus } from '../../lib/deviceStatus.js';
import { SdImportCard } from '../SdImportCard.jsx';
import { Icon } from '../Icons.jsx';
import { MaskCard } from '../MaskCard.jsx';
import { ComplianceCard } from '../ComplianceCard.jsx';

export function DesktopTherapy() {
  const { machineId, openSheet, showToast, syncNonce, cardData } = useStore();
  const status = deviceStatus(cardData, syncNonce > 0);
  // the card names the machine and its settings; nothing is filled in
  const device = cardDevice();
  const machine = machineName(machineId);
  const cells = deviceCells();

  /* the real export (as on mobile): a printable 30-night summary */
  function exportSummary() {
    if (!openDoctorReport()) showToast('Allow pop-ups for Nocta to open the summary', 'info');
  }

  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">Therapy</h1>
          <div className="dash-sub">Your machine, mask, and the paperwork</div>
        </div>
      </header>

      <div className="therapy-hero">
        <ComplianceCard />
      </div>

      <div className="dash-grid dash-grid-therapy">
        <div className="dash-col">
          {/* same heading style as Equipment's, so the two columns start level */}
          <div className="section-head">
            <h3>Your machine</h3>
          </div>
          <section className="device-card">
            <div className="dc-top">
              <span className={`dc-dot${status.live ? ' live' : ' idle'}`} aria-hidden="true" />
              <span className={`dc-status${status.live ? '' : ' idle'}`}>{status.status}</span>
            </div>
            <h3>
              {machine.brand} {machine.name}
            </h3>
            <div className="dc-sub">{status.source}</div>
            {cells.length > 0 ? (
              <div className="dc-grid">
                {cells.map((c) => (
                  <div key={c.k} className="dc-cell">
                    <div className="dc-k">{c.k}</div>
                    <div className="dc-v">{c.v}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dc-none">This card doesn’t record the machine’s settings.</p>
            )}
            {/* the card says which machine it is; only without one can it be picked */}
            {!device && (
              <button className="row-cta" onClick={() => openSheet('machinePicker')}>
                <span>Change machine</span>
                <Icon name="chevronRight" size={16} />
              </button>
            )}
            {/* the mask lives with the machine: one setup, one card (as on mobile) */}
            <MaskCard inline />
          </section>

          {/* the machine's own data comes in from its card, so it sits here */}
          <SdImportCard card={cardData} onOpen={() => openSheet('cardImport')} />
        </div>

        <div className="dash-col">
          <div className="section-head">
            <h3>Equipment</h3>
            <span className="meta">log when you replace</span>
          </div>
          <EquipmentList />

          <div className="section-head">
            <h3>For your doctor</h3>
          </div>
          <div className="list dash-export">
            <button className="list-row export-row" onClick={exportSummary}>
              <div className="lr-main">
                <div className="lr-title">Summary for your doctor</div>
                <div className="lr-sub">Your last 30 nights on one page: AHI, events, leak, use. Opens to print or save as PDF.</div>
              </div>
              <span className="export-icon">
                <Icon name="download" size={18} />
              </span>
            </button>
          </div>
        </div>
      </div>

      <p className="disclaimer">
        The export contains your data only, with no Nocta insights. It is not a medical record.
      </p>
    </>
  );
}
