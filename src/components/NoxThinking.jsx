/* Nocta — the "working on it" state: Nox thinking it over. He bobs gently,
 * his eyes wander up one way then the other, and three thought dots rise
 * from beside his head in turn. Replaces the old turning ring wherever the
 * app is busy for a moment (reading a card, signing in, restoring).
 * Decorative: the screen's own title says what's happening. */
import { Mascot } from './Mascot.jsx';

export function NoxThinking({ size = 84, className = '' }) {
  return (
    <div className={`nox-thinking ${className}`} style={{ '--nox': `${size}px` }} aria-hidden="true">
      <span className="nt-dots">
        <span />
        <span />
        <span />
      </span>
      <Mascot size={size} state="thinking" className="nt-nox" />
    </div>
  );
}
