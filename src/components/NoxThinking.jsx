/* Nocta — the "working on it" state: Nox thinking it over. He bobs gently,
 * his eyes wander up one way then the other, and three thought dots rise
 * from beside his head in turn. Replaces the old turning ring wherever the
 * app is busy for a moment (reading a card, signing in, restoring).
 * Decorative: the screen's own title says what's happening. */
import { Mascot } from './Mascot.jsx';

/* `done`: he's worked it out — happy eyes and a hop, and the thought dots
 * burst outward like a little cheer (the import's "All read") */
export function NoxThinking({ size = 84, className = '', done = false }) {
  return (
    <div className={`nox-thinking${done ? ' done' : ''} ${className}`} style={{ '--nox': `${size}px` }} aria-hidden="true">
      <span className="nt-dots">
        <span />
        <span />
        <span />
      </span>
      <Mascot key={done ? 'done' : 'thinking'} size={size} state={done ? 'pleased' : 'thinking'} pop={!done} className="nt-nox" />
    </div>
  );
}
