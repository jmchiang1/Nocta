/* Nocta — Therapy tab. Device status, equipment lifecycle, view-only settings, exports.
 * Compliance leads: it's the one number insurance holds you to. */
import { NoDataBanner } from '../components/NoNights.jsx';
import { useStore } from '../lib/store.jsx';
import { cardDevice, machineName, deviceCells } from '../data/therapy.js';
import { tracksCompliance } from '../data/compliance.js';
import { EquipmentList, EquipmentInfo } from '../components/EquipmentList.jsx';
import { InfoTip } from '../components/InfoTip.jsx';
import { openDoctorReport } from '../lib/doctorReport.js';
import { SdImportCard } from '../components/SdImportCard.jsx';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { Icon } from '../components/Icons.jsx';
import { MaskCard } from '../components/MaskCard.jsx';
import { ComplianceCard } from '../components/ComplianceCard.jsx';

export function TherapyScreen() {
  const { machineId, openSheet, showToast, cardData, hasData, authUser, profile } = useStore();
  // compliance only for an account that said it's in a window (data/compliance.js)
  const compliance = hasData && tracksCompliance(authUser, profile.answers);
  // the card names the machine and its settings; nothing is filled in
  const device = cardDevice();
  const machine = machineName(machineId);
  const cells = deviceCells();

  /* the real export: a printable summary of the last 30 nights, opened in a
   * new tab with the print dialog (save as PDF from there) */
  function exportSummary() {
    if (!openDoctorReport()) showToast('Allow pop-ups for Nocta to open the summary', 'info');
  }

  return (
    <ScreenFrame title="Therapy">
      <header className="page-head">
        <div>
          <h1>Therapy</h1>
        </div>
      </header>

      {!hasData && <NoDataBanner />}

      {/* no nights yet (an account with no card): no compliance, no machine
       * settings and no summary to show — bringing in the card comes first */}
      {compliance && <ComplianceCard />}

      {hasData && (
        <section className="device-card">
          <h3>
            {machine.brand} {machine.name}
          </h3>
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
          {/* the mask lives with the machine: one setup, one card */}
          <MaskCard inline />
        </section>
      )}

      {/* with no nights the banner at the top already asks for the card */}
      {hasData && <SdImportCard card={cardData} onOpen={() => openSheet('cardImport')} />}
      {!hasData && <MaskCard />}

      <div className="section-head">
        <h3>Equipment</h3>
        <InfoTip label="What Equipment shows">
          <EquipmentInfo />
        </InfoTip>
      </div>
      <EquipmentList />

      {hasData && (
        <>
          <div className="section-head">
            <h3>For your doctor</h3>
          </div>
          <div className="list">
            <button className="list-row export-row" onClick={exportSummary}>
              <div className="lr-main">
                <div className="lr-title">Summary for your doctor</div>
                <div className="lr-sub">
                  Your last 30 nights on one page: AHI, events, leak, use. Opens to print or save as PDF.
                </div>
              </div>
              <span className="export-icon">
                <Icon name="download" size={18} />
              </span>
            </button>
          </div>
        </>
      )}
    </ScreenFrame>
  );
}
