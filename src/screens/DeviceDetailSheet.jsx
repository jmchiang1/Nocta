/* Nocta — connected device detail. Full-screen sheet from the You tab.
 *
 * Three layers of control:
 *  1. OAuth connection (`deviceConnections`) — the access grant itself.
 *  2. Master "Use in Nocta" toggle (`deviceEnabled`) — pause without revoking.
 *  3. Per-read permissions (`deviceReads`) — fine-grained scopes.
 *
 * When the user taps Connect (not-connected state), the sheet runs a mock
 * OAuth flow: authorize → syncing → done. Each step replaces the sheet body
 * until the device flips to connected, then the normal detail view returns. */
import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { deviceByKey } from '../data/account.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { ProgressBar } from '../components/Charts.jsx';

const SYNC_NIGHTS = 30;
const SYNC_DURATION_MS = 2400;
const SYNC_HOLD_MS = 700;

/* accessible on/off switch, same shape as the one on YouScreen */
function Switch({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`switch${on ? ' on' : ''}${disabled ? ' disabled' : ''}`}
      onClick={() => !disabled && onChange(!on)}
    >
      <span className="switch-knob" />
    </button>
  );
}

/* Brand mark shown at the top of the authorize + syncing steps. Oura gets a
 * real product photo because the device-detail entry point already showed a
 * ring icon; the photo makes the handoff feel like the real OAuth screen. */
function BrandMark({ device }) {
  if (device.key === 'oura') {
    return (
      <div className="oauth-brand brand-oura is-photo">
        <img src="/ouraring.jpg" alt="" className="oauth-brand-img" />
        <div className="oauth-brand-name">{device.title}</div>
      </div>
    );
  }
  return (
    <div className={`oauth-brand brand-${device.key}`}>
      <Icon name={device.icon} size={36} />
      <div className="oauth-brand-name">{device.title}</div>
    </div>
  );
}

/* mock Oura-flavored OAuth authorize page */
function AuthorizeStep({ device, requestedReads, onAllow, onCancel }) {
  return (
    <div className="oauth">
      <BrandMark device={device} />
      <h2 className="oauth-title">Allow Nocta to access your {device.title} data?</h2>
      <p className="oauth-sub">Signed in as jonathan@example.com</p>
      <div className="oauth-perms">
        <div className="oauth-perms-head">Nocta will be able to read:</div>
        {requestedReads.length > 0 ? (
          requestedReads.map((r) => (
            <div className="oauth-perm-row" key={r}>
              <Icon name="check" size={13} />
              <span>{r}</span>
            </div>
          ))
        ) : (
          <div className="oauth-perm-row muted">No reads selected — none will be granted.</div>
        )}
      </div>
      <p className="oauth-fineprint">
        You can change these later in Nocta or revoke access at {device.title.toLowerCase()}.com.
      </p>
      <div className="oauth-actions">
        <button
          className="btn primary"
          onClick={onAllow}
          disabled={requestedReads.length === 0}
        >
          Allow access
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SyncingStep({ device, count }) {
  const pct = (count / SYNC_NIGHTS) * 100;
  return (
    <div className="oauth">
      <BrandMark device={device} />
      <h2 className="oauth-title">Pulling your last {SYNC_NIGHTS} nights…</h2>
      <p className="oauth-sub tnum">
        {count} / {SYNC_NIGHTS} nights
      </p>
      <div className="oauth-progress">
        <ProgressBar pct={pct} color="data" height={6} />
      </div>
      <p className="oauth-fineprint">
        Backfilling sleep stages, heart rate, and HRV. Future nights will sync automatically.
      </p>
    </div>
  );
}

function DoneStep({ device }) {
  return (
    <div className="oauth oauth-done">
      <div className="oauth-done-mark" aria-hidden="true">
        <Icon name="moon" size={32} />
      </div>
      <h2 className="oauth-title">{device.title} connected</h2>
      <p className="oauth-sub">
        {SYNC_NIGHTS} nights pulled in. Tonight will line your {device.title.toLowerCase()} data
        up with your therapy in tomorrow morning's summary.
      </p>
    </div>
  );
}

export function DeviceDetailSheet() {
  const {
    sheet,
    closeSheet,
    deviceConnections,
    setDeviceConnected,
    deviceEnabled,
    setDeviceEnabled,
    deviceReads,
    setDeviceRead,
  } = useStore();
  const device = deviceByKey(sheet.deviceKey);
  const connected = !!deviceConnections[device.key];
  const enabled = deviceEnabled[device.key] !== false;
  const reads = deviceReads[device.key] || {};
  const allowedReads = device.reads.filter((r) => reads[r] !== false);

  const [syncing, setSyncing] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState('idle'); // idle | authorize | syncing | done
  const [syncCount, setSyncCount] = useState(0);

  /* drive the syncing progress; ticks ~30 times across SYNC_DURATION_MS, then
   * holds at 30/30 for SYNC_HOLD_MS so the user registers the completion
   * before the screen swaps to the done state */
  useEffect(() => {
    if (step !== 'syncing') return undefined;
    const tickMs = SYNC_DURATION_MS / SYNC_NIGHTS;
    const tick = setInterval(() => {
      setSyncCount((c) => Math.min(c + 1, SYNC_NIGHTS));
    }, tickMs);
    const finish = setTimeout(() => {
      clearInterval(tick);
      setDeviceConnected(device.key, true);
      setStep('done');
    }, SYNC_DURATION_MS + SYNC_HOLD_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(finish);
    };
  }, [step, device.key, setDeviceConnected]);

  function disconnect(close) {
    setDeviceConnected(device.key, false);
    close();
  }
  function startConnect() {
    setSyncCount(0);
    setStep('authorize');
  }
  function authorize() {
    setStep('syncing');
  }
  function cancelConnect() {
    setStep('idle');
  }
  function finishConnect() {
    setStep('idle');
  }

  /* mid-flow steps replace the whole sheet body */
  if (step === 'authorize') {
    return (
      <Sheet
        title={device.title}
        eyebrow="Authorize"
        onClose={closeSheet}
        variant="page"
      >
        <AuthorizeStep
          device={device}
          requestedReads={allowedReads}
          onAllow={authorize}
          onCancel={cancelConnect}
        />
      </Sheet>
    );
  }
  if (step === 'syncing') {
    return (
      <Sheet
        title={device.title}
        eyebrow="Syncing"
        onClose={closeSheet}
        variant="page"
      >
        <SyncingStep device={device} count={syncCount} />
      </Sheet>
    );
  }
  if (step === 'done') {
    return (
      <Sheet
        title={device.title}
        eyebrow="Connected"
        onClose={closeSheet}
        variant="page"
        footerClass="sheet-foot-spacious"
        footer={
          <button className="btn primary" onClick={finishConnect}>
            Done
          </button>
        }
      >
        <DoneStep device={device} />
      </Sheet>
    );
  }

  return (
    <Sheet title={device.title} eyebrow="Connected device" onClose={closeSheet} variant="page">
      {(close) => (
        <>
          <div className="device-hero">
            <div className="dh-status">
              {connected ? (
                enabled ? (
                  <>
                    <span className="dh-dot on" /> Connected · last sync {device.lastSync || 'just now'}
                  </>
                ) : (
                  <>
                    <span className="dh-dot paused" /> Connected · paused
                  </>
                )
              ) : (
                <>
                  <span className="dh-dot off" /> Not connected
                </>
              )}
            </div>
            <p className="dh-blurb">{device.blurb}</p>
          </div>

          {connected && (
            <div className="list" style={{ marginBottom: 6 }}>
              <div className="list-row">
                <div className="lr-main">
                  <div className="lr-title">Use {device.title} in Nocta</div>
                  <div className="lr-sub">
                    {enabled
                      ? 'Data feeds your home screen and trends'
                      : 'Paused — kept connected but excluded from Nocta'}
                  </div>
                </div>
                <Switch
                  on={enabled}
                  onChange={(v) => setDeviceEnabled(device.key, v)}
                  label={`Use ${device.title} in Nocta`}
                />
              </div>
            </div>
          )}

          <div className="section-head">
            <h3>What Nocta reads</h3>
            <span className="meta">
              {connected && !enabled ? 'paused' : 'tap to allow or block'}
            </span>
          </div>
          <div className={`list${connected && !enabled ? ' muted' : ''}`}>
            {device.reads.map((r) => {
              const on = reads[r] !== false;
              return (
                <div className="list-row" key={r}>
                  <div className="lr-main">
                    <div className="lr-title">{r}</div>
                  </div>
                  <Switch
                    on={on}
                    onChange={(v) => setDeviceRead(device.key, r, v)}
                    label={`Allow ${r}`}
                    disabled={connected && !enabled}
                  />
                </div>
              );
            })}
          </div>

          {connected && (
            <>
              <div className="section-head">
                <h3>Sync</h3>
              </div>
              <div className="list">
                <div className="list-row">
                  <div className="lr-main">
                    <div className="lr-title">Background sync</div>
                    <div className="lr-sub">
                      {syncing
                        ? 'New nights pull in automatically'
                        : 'Paused — pull manually from Tonight'}
                    </div>
                  </div>
                  <Switch on={syncing} onChange={setSyncing} label="Background sync" />
                </div>
              </div>

              <div className="section-head">
                <h3>Danger zone</h3>
              </div>
              <p className="settings-note">
                Disconnecting revokes Nocta’s access entirely. Past data already pulled in
                stays; no new {device.title} data flows in until you reconnect.
              </p>

              {!confirming ? (
                <button className="btn destructive" onClick={() => setConfirming(true)}>
                  Disconnect from Nocta
                </button>
              ) : (
                <div className="confirm-row">
                  <p className="confirm-text">
                    Disconnect {device.title}? You can reconnect later, but past sync history is kept.
                  </p>
                  <div className="confirm-actions">
                    <button className="btn ghost" onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                    <button className="btn destructive" onClick={() => disconnect(close)}>
                      Yes, disconnect
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {!connected && (
            <>
              <div className="section-head">
                <h3>Connect</h3>
              </div>
              <p className="settings-note">
                You’ll be sent to {device.title} to authorize Nocta. Only the reads you’ve
                allowed above will be requested — you can change or revoke them later.
              </p>
              <button
                className="btn primary"
                onClick={startConnect}
                disabled={allowedReads.length === 0}
              >
                Connect {device.title}
              </button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
