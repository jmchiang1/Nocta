/* Nocta — wearables. Opened from the Wearables row on the You tab. With real
 * sign-in (Supabase), Oura, Fitbit, Whoop and Withings connect for real: tap one for
 * its detail sheet, where Connect runs. The rest are listed as coming soon and
 * say so plainly: nothing here pretends to pair or pull data. Without
 * Supabase (the mock sign-in), all of them are coming soon. The one the person
 * said they wear (onboarding) is marked. */
import { useStore } from '../lib/store.jsx';
import { CONNECTED_DEVICES, DEVICE_PHOTO } from '../data/account.js';
import { isLiveWearable } from '../lib/wearables.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

/* onboarding's wearable ids → these device keys */
const FROM_ONBOARDING = { apple_watch: 'watch', oura: 'oura', fitbit: 'fitbit', garmin: 'garmin', samsung: 'samsung', whoop: 'whoop' };

function DeviceIcon({ device }) {
  const photo = DEVICE_PHOTO[device.key];
  return photo ? (
    <div className="lr-icon app">
      <img src={photo} alt="" />
    </div>
  ) : (
    <div className="lr-icon">
      <Icon name={device.icon} size={17} />
    </div>
  );
}

export function AddDeviceSheet() {
  const { closeSheet, openSheet, profile, authConfigured, deviceConnections } = useStore();
  const theirs = FROM_ONBOARDING[profile.answers.healthDevice];
  const live = (d) => authConfigured && isLiveWearable(d.key);
  const connectable = CONNECTED_DEVICES.filter(live);
  const soon = CONNECTED_DEVICES.filter((d) => !live(d));
  const yours = (d) => (d.key === theirs ? 'You told us you wear this · ' : '');

  return (
    <Sheet
      title="Wearables"
      eyebrow={connectable.length ? 'Connect' : 'Coming soon'}
      onClose={closeSheet}
      variant="page"
    >
      {connectable.length > 0 ? (
        <>
          <div className="list">
            {connectable.map((d) => (
              <button key={d.key} className="list-row" onClick={() => openSheet('deviceDetail', { deviceKey: d.key })}>
                <DeviceIcon device={d} />
                <div className="lr-main">
                  <div className="lr-title">{d.title}</div>
                  <div className="lr-sub">
                    {yours(d)}
                    {deviceConnections[d.key] ? 'Connected' : d.short}
                  </div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            ))}
          </div>
          <div className="section-head">
            <h3>Coming soon</h3>
          </div>
        </>
      ) : (
        <p className="settings-note">
          Wearables can’t be connected yet.
        </p>
      )}

      <div className="list">
        {soon.map((d) => (
          <div key={d.key} className="list-row soon">
            <DeviceIcon device={d} />
            <div className="lr-main">
              <div className="lr-title">{d.title}</div>
              <div className="lr-sub">{yours(d)}Coming soon</div>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
