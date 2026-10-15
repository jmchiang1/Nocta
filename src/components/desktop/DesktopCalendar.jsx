/* Nocta — the all-nights calendar as a wide desktop dialog (opened from the
 * day heading on Tonight). The calendar itself is shared with the phone:
 * components/NightCalendar.jsx. */
import { useStore } from '../../lib/store.jsx';
import { Icon } from '../Icons.jsx';
import { NightCalendar } from '../NightCalendar.jsx';

export function DesktopCalendar() {
  const { setFixtureId, setTab, closeSheet } = useStore();

  function openNight(id) {
    setFixtureId(id);
    setTab('tonight');
    closeSheet();
  }

  return (
    <div className="cal">
      <header className="dfn-head">
        <h2 className="dfn-title">Your nights on therapy</h2>
        <button className="dfn-close" onClick={closeSheet} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </header>

      <NightCalendar onOpen={openNight} />

      {/* <p className="disclaimer">Your nights as your machine recorded them. They are not a diagnosis.</p> */}
    </div>
  );
}
