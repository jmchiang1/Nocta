/* Nocta — floating Coach button. Peach is the exclusive AI accent. */
import { useStore } from '../lib/store.jsx';
import { Icon } from './Icons.jsx';

export function CoachFab() {
  const { openSheet } = useStore();
  return (
    <button
      className="coach-fab"
      aria-label="Ask Nocta Coach"
      onClick={() => openSheet('coach')}
    >
      <Icon name="coach" size={22} />
    </button>
  );
}
