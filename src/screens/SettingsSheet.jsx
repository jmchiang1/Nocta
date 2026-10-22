/* Nocta — Settings subpage. Full-screen sheet from the You tab.
 * Profile photo, sign-in & security, reminders, export and delete, and the
 * medical disclaimer. */
import { soundEffectsOn, setSoundEffects, noxHop } from '../lib/sound.js';
import { analyticsConfigured, analyticsOn, setAnalytics, track } from '../lib/analytics.js';
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { PRIVACY_NOTE, MEDICAL_NOTE } from '../data/account.js';
import { exportMyData } from '../lib/accountData.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { setReminders, missingQuestions, setCheckinReminder } from '../lib/profile.js';

/* accessible on/off switch — same one used in YouScreen */
function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="switch-knob" />
    </button>
  );
}

/* the page's sections, shared with the desktop You page (rendered inline
 * there rather than one click away). Every control here does what it says:
 * nothing is a display-only switch. `children` lands after Your data, just
 * above the disclaimer — the desktop page puts Sign in there. */
export function SettingsContent({ children }) {
  // sub-pages stack on Settings, so Back returns here (desktop: on an empty stack)
  const { profile, authUser, pushSheet: openSheet, showToast } = useStore();
  const missing = missingQuestions(profile).length;
  const [exporting, setExporting] = useState(false);
  const [sounds, setSounds] = useState(soundEffectsOn);
  const [sharing, setSharing] = useState(analyticsOn);
  const guest = !authUser || authUser.kind === 'guest';

  return (
    <>
      {/* ---- sign-in & security ---- */}
      {!guest && (
        <>
          <div className="section-head">
            <h3>Sign-in &amp; security</h3>
          </div>
          <div className="list">
            {authUser.kind === 'email' ? (
              <button className="list-row" onClick={() => openSheet('changePassword')}>
                <div className="lr-icon bare">
                  <Icon name="lock" size={17} />
                </div>
                <div className="lr-main">
                  <div className="lr-title">Change password</div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            ) : (
              <div className="list-row">
                <div className="lr-icon bare">
                  <Icon name="lock" size={17} />
                </div>
                <div className="lr-main">
                  <div className="lr-title">Signed in with {authUser.kind === 'apple' ? 'Apple' : 'Google'}</div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---- notifications: what Nocta actually does ---- */}
      <div className="section-head">
        <h3>Reminders</h3>
      </div>
      <div className="list">
        <div className="list-row">
          <div className="lr-icon bare">
            <Icon name="bell" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Morning check-in reminder</div>
          </div>
          <Switch
            on={Boolean(profile.checkinReminder)}
            onChange={setCheckinReminder}
            label="Morning check-in reminder"
          />
        </div>
        {!guest && (
          <div className="list-row">
            <div className="lr-icon bare">
              <Icon name="info" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Quick questions</div>
            </div>
            <Switch
              on={!profile.reminders.off}
              onChange={(on) => setReminders({ off: !on, snoozedUntil: null })}
              label="Quick question reminders"
            />
          </div>
        )}
      </div>

      {/* ---- sound: Nox's little sounds as he lands and hops (lib/sound.js) ---- */}
      <div className="section-head">
        <h3>Sound</h3>
      </div>
      <div className="list">
        <div className="list-row">
          <div className="lr-icon bare">
            <Icon name="sound" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Sound effects</div>
          </div>
          <Switch
            on={sounds}
            onChange={(on) => {
              setSoundEffects(on);
              setSounds(on);
              if (on) noxHop(1); // a little hello
            }}
            label="Sound effects"
          />
        </div>
      </div>

      {/* ---- feedback to the people making Nocta (FeedbackSheet) ---- */}
      <div className="section-head">
        <h3>Help improve Nocta</h3>
      </div>
      <div className="list">
        <button className="list-row" onClick={() => openSheet('feedback', { source: 'settings' })}>
          <div className="lr-icon bare">
            <Icon name="send" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Send feedback</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
        {/* usage analytics (lib/analytics.js): only where they're set up */}
        {analyticsConfigured && (
          <div className="list-row">
            <div className="lr-icon bare">
              <Icon name="trends" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Share usage data</div>
            </div>
            <Switch
              on={sharing}
              onChange={(on) => {
                // turning it off sends nothing, not even that it was turned off
                setAnalytics(on);
                setSharing(on);
                if (on) track('analytics_on');
              }}
              label="Share usage data"
            />
          </div>
        )}
      </div>

      {/* ---- your data: an account's only. A guest is looking at sample
       * nights, so there's nothing of theirs to export or delete ---- */}
      {!guest && (
        <>
          <div className="section-head">
            <h3>Your data</h3>
          </div>
          {/* <p className="settings-note">{PRIVACY_NOTE}</p> */}
          <div className="list">
            <button
              className="list-row"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  const r = await exportMyData(authUser);
                  track('data_exported');
                  showToast(`Downloaded: ${r.nights} nights, ${r.checkins} check-ins`, 'download');
                } finally {
                  setExporting(false);
                }
              }}
            >
              <div className="lr-icon bare accent">
                <Icon name="download" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">Export my data</div>
              </div>
            </button>
            <button className="list-row" onClick={() => openSheet('deleteAccount')}>
              <div className="lr-icon bare">
                <Icon name="x" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title destructive">Delete account</div>
              </div>
              <Icon name="chevronRight" size={17} />
            </button>
          </div>
        </>
      )}

      {children}

      {/* ---- privacy and terms: subpages (LegalSheet) showing the public
       * pages' text (public/privacy.html, public/terms.html) ---- */}
      <div className="section-head">
        <h3>Privacy and terms</h3>
      </div>
      <div className="list">
        <button className="list-row" onClick={() => openSheet('legal', { doc: 'privacy' })}>
          <div className="lr-icon bare">
            <Icon name="shield" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Privacy Policy</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
        <button className="list-row" onClick={() => openSheet('legal', { doc: 'terms' })}>
          <div className="lr-icon bare">
            <Icon name="doc" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Terms of Service</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
      </div>

      {/* last on the page: what Nocta is, and isn't */}
      <div className="section-head">
        <h3>Medical disclaimer</h3>
      </div>
      <p className="settings-note">{MEDICAL_NOTE}</p>
    </>
  );
}

export function SettingsSheet() {
  const { closeSheet } = useStore();

  return (
    <Sheet title="Settings" onClose={closeSheet} variant="page">
      <SettingsContent />
    </Sheet>
  );
}
