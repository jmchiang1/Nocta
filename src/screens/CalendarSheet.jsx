/* Nocta — every night on therapy. Opened by tapping the day heading on
 * Tonight (like myAir's night list). On the phone it's NightList: a month at a
 * time, its nights newest first; desktop's dialog keeps the full month
 * calendar (both in components/NightCalendar.jsx). */
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { NightList } from '../components/NightCalendar.jsx';

export function CalendarSheet() {
  const { closeSheet, setFixtureId } = useStore();

  return (
    // a regular (not full-page) sheet; no visible title — the month in NightList
    // is the heading, with the X alone on its own line above it. `title` stays
    // as the dialog's accessible name.
    <Sheet title="Your nights on therapy" onClose={closeSheet} className="cal-sheet">
      {(close) => (
        <>
          <NightList
            onOpen={(id) => {
              setFixtureId(id);
              close();
            }}
          />
          {/* <p className="disclaimer">Your nights as your machine recorded them. They are not a diagnosis.</p> */}
        </>
      )}
    </Sheet>
  );
}
