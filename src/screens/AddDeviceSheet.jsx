/* Nocta — wearables. Opened from "Add a device" on the You tab. Nocta can't
 * connect wearables yet, so this lists what's planned and says so plainly:
 * nothing here pretends to pair or pull data. The one the person said they
 * wear (onboarding) is marked. */
import { useStore } from '../lib/store.jsx';
import { CONNECTED_DEVICES, DEVICE_PHOTO } from '../data/account.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

/* onboarding's wearable ids → these device keys */
const FROM_ONBOARDING = { apple_watch: 'watch', oura: 'oura', fitbit: 'fitbit', garmin: 'garmin', samsung: 'samsung', whoop: 'whoop' };

export function AddDeviceSheet() {
  const { closeSheet, profile } = useStore();
  const theirs = FROM_ONBOARDING[profile.answers.healthDevice];

  return (
    <Sheet title="Wearables" eyebrow="Coming soon" onClose={closeSheet} variant="page">
      <p className="settings-note">
        Nocta can’t connect wearables yet. When it can, it will line your heart rate and sleep
        stages up against your therapy. For now, everything you see comes from your CPAP’s SD
        card.
      </p>

      <div className="list">
        {CONNECTED_DEVICES.map((d) => {
          const photo = DEVICE_PHOTO[d.key];
          return (
            <div key={d.key} className="list-row soon">
              {photo ? (
                <div className="lr-icon app">
                  <img src={photo} alt="" />
                </div>
              ) : (
                <div className="lr-icon">
                  <Icon name={d.icon} size={17} />
                </div>
              )}
              <div className="lr-main">
                <div className="lr-title">{d.title}</div>
                <div className="lr-sub">{d.key === theirs ? 'You told us you wear this · coming soon' : 'Coming soon'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
