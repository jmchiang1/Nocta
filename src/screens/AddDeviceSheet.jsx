/* Nocta — Add device picker. Opened from the "Add a device" row on the You
 * tab. Lists every supported integration that isn't already connected; tap
 * one to jump into its device-detail sheet where the connect flow runs. */
import { useStore } from '../lib/store.jsx';
import { CONNECTED_DEVICES, DEVICE_PHOTO } from '../data/account.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

export function AddDeviceSheet() {
  const { closeSheet, deviceConnections, openSheet } = useStore();
  const available = CONNECTED_DEVICES.filter((d) => !deviceConnections[d.key]);

  function pick(deviceKey) {
    /* swap straight into the device-detail sheet — its not-connected view
     * walks the user through reads + the authorize/syncing/done flow */
    openSheet('deviceDetail', { deviceKey });
  }

  return (
    <Sheet
      title="Add a device"
      eyebrow="Connect"
      onClose={closeSheet}
      variant="page"
    >
      <p className="settings-note">
        Pair a wearable so Nocta can line your heart rate, sleep stages, and recovery up
        against your CPAP therapy each night.
      </p>

      {available.length === 0 ? (
        <p className="empty-state">All supported devices are already connected.</p>
      ) : (
        <div className="list">
          {available.map((d) => {
            const photo = DEVICE_PHOTO[d.key];
            return (
              <button key={d.key} className="list-row" onClick={() => pick(d.key)}>
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
                  <div className="lr-sub">{d.short}</div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            );
          })}
        </div>
      )}

      <p className="settings-note" style={{ marginTop: 16 }}>
        Don’t see your device? Nocta supports more wearables soon. You can always export
        your CPAP data to PDF from the Therapy tab in the meantime.
      </p>
    </Sheet>
  );
}
