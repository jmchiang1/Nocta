/* Nocta — Settings subpage. Full-screen sheet from the You tab.
 * Profile photo, sign-in & security, reminders, export and delete, and the
 * medical disclaimer. */
import { useState, useRef } from 'react';
import { useStore } from '../lib/store.jsx';
import { PRIVACY_NOTE, MEDICAL_NOTE } from '../data/account.js';
import { ProfileAvatar } from '../components/ProfileAvatar.jsx';
import { exportMyData } from '../lib/accountData.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { setReminders, missingQuestions, setPhoto, setCheckinReminder } from '../lib/profile.js';

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

/* a photo, scaled down to 256 px (a small JPEG kept on this device) */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      // centre-crop to a square, like the round avatar shows it
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* the page's sections, shared with the desktop You page (rendered inline
 * there rather than one click away). Every control here does what it says:
 * nothing is a display-only switch. */
export function SettingsContent() {
  // sub-pages stack on Settings, so Back returns here (desktop: on an empty stack)
  const { profile, authUser, pushSheet: openSheet, showToast } = useStore();
  const missing = missingQuestions(profile).length;
  const fileRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const guest = !authUser || authUser.kind === 'guest';
  const photo = profile.photo ?? authUser?.photo ?? null;

  return (
    <>
      {/* ---- profile photo ---- */}
      <div className="section-head">
        <h3>Profile</h3>
      </div>
      <div className="list">
        <div className="list-row st-photo">
          <div className="st-avatar">
            <ProfileAvatar user={authUser} />
          </div>
          <div className="lr-main">
            <div className="lr-title">{authUser?.name ?? authUser?.email ?? 'Your profile'}</div>
            <div className="st-photo-actions">
              <button type="button" className="ob-link" onClick={() => fileRef.current?.click()}>
                {photo ? 'Change photo' : 'Add a photo'}
              </button>
              {profile.photo && (
                <button type="button" className="ob-link subtle" onClick={() => setPhoto(null)}>
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                setPhoto(await shrink(f));
                showToast('Photo updated', 'check');
              } catch {
                showToast('That image couldn’t be read', 'info');
              }
            }}
          />
        </div>
      </div>

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
                  <div className="lr-sub">{authUser.email}</div>
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
                  <div className="lr-sub">
                    There’s no Nocta password to change. Your password is managed by your{' '}
                    {authUser.kind === 'apple' ? 'Apple ID' : 'Google account'}.
                  </div>
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
            <div className="lr-sub">7:00 AM. Sent by the iPhone app once it’s out; the web version can’t send reminders</div>
          </div>
          <Switch on={Boolean(profile.checkinReminder)} onChange={setCheckinReminder} label="Morning check-in reminder" />
        </div>
        {!guest && (
          <div className="list-row">
            <div className="lr-icon bare">
              <Icon name="info" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Quick questions</div>
              <div className="lr-sub">
                {missing
                  ? `Now and then on Tonight, ask the ${missing === 1 ? 'question' : `${missing} questions`} I skipped`
                  : 'You’ve answered everything'}
              </div>
            </div>
            <Switch
              on={!profile.reminders.off}
              onChange={(on) => setReminders({ off: !on, snoozedUntil: null })}
              label="Quick question reminders"
            />
          </div>
        )}
      </div>

      {/* ---- your data ---- */}
      <div className="section-head">
        <h3>Your data</h3>
      </div>
      <p className="settings-note">{PRIVACY_NOTE}</p>
      <div className="list">
        <button
          className="list-row"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const r = await exportMyData(authUser);
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
            <div className="lr-sub">{exporting ? 'Preparing your file…' : 'Download everything Nocta holds, as a JSON file'}</div>
          </div>
        </button>
        <button className="list-row" onClick={() => openSheet('deleteAccount')}>
          <div className="lr-icon bare">
            <Icon name="x" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title destructive">{guest ? 'Erase this device’s data' : 'Delete account'}</div>
            <div className="lr-sub">{guest ? 'Remove everything Nocta keeps here' : 'Permanently delete your account and data'}</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
      </div>

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
