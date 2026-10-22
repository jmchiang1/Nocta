/* Nocta — connected device detail. Full-screen sheet from the You tab.
 *
 * Three layers of control:
 *  1. OAuth connection (`deviceConnections`) — the access grant itself.
 *  2. Master "Use in Nocta" toggle (`deviceEnabled`) — pause without revoking.
 *  3. Per-read permissions (`deviceReads`) — fine-grained scopes.
 *
 * Oura, Fitbit, Whoop and Withings are real with Supabase set up (LiveDeviceDetail):
 * Connect opens the provider's approve screen in a new tab while this sheet
 * waits. When the tab reports back (lib/wearables.js → lib/store.jsx), the
 * sheet reopens with a fresh `justConnected`, which runs the first sync. Per-read toggles decide what Nocta shows; the provider
 * grant itself is fixed (supabase/functions/nocta-wearables/providers.ts).
 *
 * Without Supabase (the mock sign-in), the sheet runs a mock OAuth flow:
 * authorize → syncing → done. Each step replaces the sheet body until the
 * device flips to connected, then the normal detail view returns. */
import { track } from '../lib/analytics.js';
import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { deviceByKey, DEVICE_PHOTO } from '../data/account.js';
import { NIGHTS_ON_THERAPY } from '../data/history.js';
import { isLiveWearable, syncedAgo } from '../lib/wearables.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { ProgressBar } from '../components/Charts.jsx';

// pulls the same nights you've been on therapy, so the counts match everywhere
const SYNC_NIGHTS = NIGHTS_ON_THERAPY;
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

/* Brand mark shown at the top of the authorize + syncing steps: the device's
 * real app icon (public/brands), so the handoff feels like the real OAuth
 * screen. Falls back to its line icon if a device has no artwork. */
function BrandMark({ device }) {
  const photo = DEVICE_PHOTO[device.key];
  if (photo) {
    return (
      <div className={`oauth-brand brand-${device.key} is-photo`}>
        <img src={photo} alt="" className="oauth-brand-img" />
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
          <div className="oauth-perm-row muted">No reads selected, so none will be granted.</div>
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

/* a device key that isn't known (a stale link, an old saved state) shows
 * nothing rather than taking the whole app down */
export function DeviceDetailSheet() {
  const { sheet, authConfigured } = useStore();
  const device = deviceByKey(sheet?.deviceKey);
  if (!device) return null;
  return authConfigured && isLiveWearable(device.key) ? <LiveDeviceDetail /> : <DeviceDetail />;
}

/* ---------------------------------------------------------------- live */

/* what a failed call means to the person */
function wearableError(code, title) {
  if (code === 'not_configured') return `${title} isn’t set up on Nocta’s server yet.`;
  if (code === 'reconnect') return `${title} needs you to connect again.`;
  if (code === 'unauthorized') return 'Your session ended. Sign in again, then retry.';
  return 'Couldn’t reach Nocta’s server. Try again in a moment.';
}

/* the first sync after approving: no count is known up front, so the bar
 * creeps toward 90% and finishes when the nights arrive */
function LiveSyncingStep({ device }) {
  const [pct, setPct] = useState(8);
  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(90, p + (90 - p) * 0.12)), 250);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="oauth">
      <BrandMark device={device} />
      <h2 className="oauth-title">Pulling your nights…</h2>
      <p className="oauth-sub">Up to your last 90 nights from {device.title}.</p>
      <div className="oauth-progress">
        <ProgressBar pct={pct} color="data" height={6} />
      </div>
      <p className="oauth-fineprint">This takes a few seconds. New nights pull in when you open Nocta.</p>
    </div>
  );
}

function LiveDoneStep({ device, count }) {
  return (
    <div className="oauth oauth-done">
      <div className="oauth-done-mark" aria-hidden="true">
        <Icon name="moon" size={32} />
      </div>
      <h2 className="oauth-title">{device.title} connected</h2>
      <p className="oauth-sub">
        {count > 0
          ? `${count} ${count === 1 ? 'night' : 'nights'} pulled in. Where a night lines up with your CPAP card, Tonight shows it under “Your body overnight.”`
          : `${device.title} had no nights from the last 90 days yet. New nights pull in when you open Nocta.`}
      </p>
    </div>
  );
}

function LiveDeviceDetail() {
  const {
    sheet,
    closeSheet,
    wearablesReady,
    wearables,
    connectWearable,
    syncWearableNow,
    wearableAutoSync,
    setWearableAutoSync,
    setDeviceConnected,
    deviceEnabled,
    setDeviceEnabled,
    deviceReads,
    setDeviceRead,
    switchToAccount,
  } = useStore();
  const device = deviceByKey(sheet.deviceKey);
  const key = device.key;
  const link = wearables.links[key];
  const connected = !!link;
  const enabled = deviceEnabled[key] !== false;
  const reads = deviceReads[key] || {};
  const autoSync = wearableAutoSync[key] !== false;
  const onServer = wearables.available.includes(key);

  const [step, setStep] = useState(sheet.justConnected ? 'syncing' : 'idle'); // idle | syncing | done
  const [pulled, setPulled] = useState(0);
  const [busy, setBusy] = useState(null); // 'connect' | 'waiting' (approve tab open) | 'disconnect'
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirming, setConfirming] = useState(false);

  /* back from the approve screen: a new justConnected each time, so a sheet
   * that stayed open while the tab was out starts its first sync too */
  useEffect(() => {
    if (!sheet.justConnected) return;
    setBusy(null);
    setError(null);
    setStep('syncing');
  }, [sheet.justConnected]);

  /* the first sync, right after coming back from the approve screen */
  useEffect(() => {
    if (step !== 'syncing') return undefined;
    let alive = true;
    syncWearableNow(key)
      .then((r) => {
        if (!alive) return;
        setPulled(r.nights);
        setStep('done');
      })
      .catch((e) => {
        if (!alive) return;
        setError(wearableError(e.code, device.title));
        setStep('idle');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function connect() {
    setError(null);
    setBusy('connect');
    track('wearable_connect_started', { provider: key });
    try {
      // 'tab': the approve screen is open in a new tab, wait for it here
      // 'redirect': the tab was blocked, so this page is leaving instead
      if ((await connectWearable(key)) === 'tab') setBusy('waiting');
    } catch (e) {
      setError(wearableError(e.code, device.title));
      setBusy(null);
    }
  }
  async function syncNow() {
    setError(null);
    setNotice(null);
    try {
      const r = await syncWearableNow(key);
      if (r.throttled) setNotice(`${device.title} allows one sync every 10 minutes. Try again shortly.`);
      else setNotice(r.nights ? `${r.nights} ${r.nights === 1 ? 'night' : 'nights'} checked.` : 'No new nights yet.');
    } catch (e) {
      setError(wearableError(e.code, device.title));
    }
  }
  async function disconnect(close) {
    setError(null);
    setBusy('disconnect');
    track('wearable_disconnected', { provider: key });
    try {
      await setDeviceConnected(key, false);
      close();
    } catch (e) {
      setError(wearableError(e.code, device.title));
      setBusy(null);
      setConfirming(false);
    }
  }

  if (step === 'syncing') {
    return (
      <Sheet title={device.title} eyebrow="Syncing" onClose={closeSheet} variant="page">
        <LiveSyncingStep device={device} />
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
          <button className="btn primary" onClick={() => setStep('idle')}>
            Done
          </button>
        }
      >
        <LiveDoneStep device={device} count={pulled} />
      </Sheet>
    );
  }

  const status = !connected ? (
    <>
      <span className="dh-dot off" /> Not connected
    </>
  ) : link.needsReconnect ? (
    <>
      <span className="dh-dot paused" /> Needs reconnecting
    </>
  ) : !enabled ? (
    <>
      <span className="dh-dot paused" /> Connected · paused
    </>
  ) : (
    <>
      <span className="dh-dot on" /> Connected ·{' '}
      {link.syncing
        ? 'syncing…'
        : link.test
          ? 'test data from Oura’s sandbox'
          : link.lastSyncAt
            ? `synced ${syncedAgo(link.lastSyncAt)}`
            : 'not synced yet'}
    </>
  );

  const errorBox = error && (
    <p className="ci-error" role="alert">
      <Icon name="info" size={16} />
      <span>{error}</span>
    </p>
  );

  return (
    <Sheet title={device.title} eyebrow="Wearable" onClose={closeSheet} variant="page">
      {(close) => (
        <>
          <div className="device-hero">
            <div className="dh-status">{status}</div>
            <p className="dh-blurb">{device.blurb}</p>
          </div>

          {connected && (
            <div className="list" style={{ marginBottom: 6 }}>
              <div className="list-row">
                <div className="lr-main">
                  <div className="lr-title">Use {device.title} in Nocta</div>
                  <div className="lr-sub">
                    {enabled ? 'Shows on Tonight next to your therapy' : 'Paused: kept connected but hidden in Nocta'}
                  </div>
                </div>
                <Switch on={enabled} onChange={(v) => setDeviceEnabled(key, v)} label={`Use ${device.title} in Nocta`} />
              </div>
            </div>
          )}

          <div className="section-head">
            <h3>What Nocta shows</h3>
            {connected && !enabled && <span className="meta">paused</span>}
          </div>
          <div className={`list${connected && !enabled ? ' muted' : ''}`}>
            {device.reads.map((r) => (
              <div className="list-row" key={r}>
                <div className="lr-main">
                  <div className="lr-title">{r}</div>
                </div>
                <Switch
                  on={reads[r] !== false}
                  onChange={(v) => setDeviceRead(key, r, v)}
                  label={`Show ${r}`}
                  disabled={connected && !enabled}
                />
              </div>
            ))}
          </div>

          {errorBox}

          {connected && (
            <>
              <div className="section-head">
                <h3>Sync</h3>
              </div>
              <div className="list">
                <div className="list-row">
                  <div className="lr-main">
                    <div className="lr-title">Sync when you open Nocta</div>
                    <div className="lr-sub">
                      {autoSync ? 'New nights pull in about once an hour' : 'Off: new nights only come in when you sync'}
                    </div>
                  </div>
                  <Switch on={autoSync} onChange={(v) => setWearableAutoSync(key, v)} label="Sync when you open Nocta" />
                </div>
                <button className="list-row" onClick={syncNow} disabled={link.syncing || link.needsReconnect}>
                  <div className="lr-icon bare">
                    <Icon name="refresh" size={17} />
                  </div>
                  <div className="lr-main">
                    <div className="lr-title">{link.syncing ? 'Syncing…' : 'Sync now'}</div>
                    {notice && <div className="lr-sub">{notice}</div>}
                  </div>
                </button>
              </div>

              {link.needsReconnect && (
                <button
                  className="btn primary"
                  onClick={connect}
                  disabled={busy === 'connect' || busy === 'waiting'}
                  style={{ marginBottom: 18 }}
                >
                  {busy === 'connect'
                    ? `Opening ${device.title}…`
                    : busy === 'waiting'
                      ? `Finish in the ${device.title} tab`
                      : `Reconnect ${device.title}`}
                </button>
              )}

              <div className="section-head">
                <h3>Danger zone</h3>
              </div>
              <p className="settings-note">
                Disconnecting removes Nocta’s access to your {device.title}. Nights already pulled in
                stay in Nocta; nothing new comes in until you connect again.
              </p>
              {!confirming ? (
                <button className="btn destructive" onClick={() => setConfirming(true)}>
                  Disconnect from Nocta
                </button>
              ) : (
                <div className="confirm-row">
                  <p className="confirm-text">Disconnect {device.title}? You can connect it again later.</p>
                  <div className="confirm-actions">
                    <button className="btn ghost" onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                    <button className="btn destructive" onClick={() => disconnect(close)} disabled={busy === 'disconnect'}>
                      {busy === 'disconnect' ? 'Disconnecting…' : 'Yes, disconnect'}
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
              {!wearablesReady ? (
                <>
                  <p className="settings-note">
                    Connecting a wearable needs a Nocta account, so its nights have somewhere to
                    live. As a guest, nothing is saved.
                  </p>
                  <button className="btn primary" onClick={() => switchToAccount('signup')}>
                    Create an account
                  </button>
                </>
              ) : !wearables.loaded ? (
                <p className="settings-note">Nocta can’t reach its wearable service right now. Try again later.</p>
              ) : !onServer ? (
                <p className="settings-note">{device.title} isn’t set up on Nocta’s server yet.</p>
              ) : busy === 'waiting' ? (
                <>
                  <p className="settings-note">
                    Finish in the {device.title} tab. This page picks up as soon as you approve.
                  </p>
                  <button className="btn ghost" onClick={() => setBusy(null)}>
                    Start over
                  </button>
                </>
              ) : (
                <>
                  <p className="settings-note">
                    {device.title} opens in a new tab so you can approve Nocta. Nocta pulls
                    up to your last 90 nights. You can remove Nocta’s access in {device.title} at any time.
                  </p>
                  <button className="btn primary" onClick={connect} disabled={busy === 'connect'}>
                    {busy === 'connect' ? `Opening ${device.title}…` : `Connect ${device.title}`}
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- mock */

function DeviceDetail() {
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
                      : 'Paused: kept connected but excluded from Nocta'}
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
                        : 'Paused: no new data comes in until it’s back on'}
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
                allowed above will be requested. You can change or revoke them later.
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
