/* Nocta — desktop Therapy view. Compliance leads (it's the one number
 * insurance holds you to); under it the machine, its mask, the SD import and
 * the doctor export sit beside the equipment schedule, which is always open
 * here (there's the room). */
import { NoDataBanner } from '../NoNights.jsx';
import { useStore } from '../../lib/store.jsx';
import { cardDevice, machineName, deviceCells } from '../../data/therapy.js';
import { tracksCompliance } from '../../data/compliance.js';
import { EquipmentList } from '../EquipmentList.jsx';
import { openDoctorReport } from '../../lib/doctorReport.js';
import { deviceSource } from '../../lib/deviceStatus.js';
import { SdImportCard } from '../SdImportCard.jsx';
import { Icon } from '../Icons.jsx';
import { MaskCard } from '../MaskCard.jsx';
import { ComplianceCard } from '../ComplianceCard.jsx';

export function DesktopTherapy() {
  const { machineId, openSheet, showToast, cardData, hasData, authUser, profile } = useStore();
  // compliance only for an account that said it's in a window (data/compliance.js)
  const compliance = hasData && tracksCompliance(authUser, profile.answers);
  const source = deviceSource(cardData);
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
        </div>
      </header>

      {!hasData && <NoDataBanner />}

      {/* no nights yet (an account with no card): no compliance, machine
       * settings or summary to show — bringing in the card comes first */}
      {compliance && (
        <div className="therapy-hero">
          <ComplianceCard />
        </div>
      )}

      <div className={`dash-grid dash-grid-therapy${hasData ? '' : ' no-nights'}`}>
        <div className="dash-col">
          {hasData ? (
            <>
              {/* same heading style as Equipment's, so the two columns start level */}
              <div className="section-head">
                <h3>Your machine</h3>
              </div>
              <section className="device-card">
                <h3>
                  {machine.brand} {machine.name}
                </h3>
                <div className="dc-sub">{source}</div>
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

              <div className="section-head">
                <h3>For your doctor</h3>
              </div>
              <div className="list dash-export">
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
          ) : (
            <>
              {/* with no nights the banner at the top already asks for the card */}
              <MaskCard />
            </>
          )}
        </div>

        <div className="dash-col">
          <div className="section-head">
            <h3>Equipment</h3>
          </div>
          <EquipmentList collapsible={false} />
        </div>
      </div>
    </>
  );
}
