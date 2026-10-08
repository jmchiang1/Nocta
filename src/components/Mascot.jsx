/* Nocta — the mascot. A small full moon with a bite out of the corner: the
 * face of the Coach. Peach, because it *is* the AI.
 *
 * Its expression tracks the conversation, never the night. No smile for a low
 * AHI, no frown for a leak — a mood face would be a red/green score with eyes.
 *
 * States (motion only for genuine in-progress moments, per DESIGN_SYSTEM › Motion):
 *   still     default — no motion (Ask Nox rows, chat history)
 *   thinking  the Coach is typing — eyes drift up, small bob
 *   talking   a reply is streaming in
 *   asleep    last night is syncing — eyes closed, slow breath
 *   waking    one-shot: eyes open with a blink (sync finished)
 *   idle      every so often the eyes glance around and blink, then rest
 *             (the Coach entry on Tonight, so it reads as present, not a logo)
 *   pleased   one-shot: a little hop and happy ^ ^ eyes. For finishing
 *             something the *user* did (a logged check-in), never as a
 *             verdict on the night.
 *
 * At 24px and below it switches to a simpler optical size — wider eyes, no
 * craters, a bigger bite — so it never turns into a smudge. */
import { useId } from 'react';

const EYE_X = [37, 55]; // eye centres in the 100×100 box
const EYE_Y = 55;

export function Mascot({ size = 24, state = 'still', label, className = '' }) {
  const id = useId().replace(/:/g, ''); // React ids contain colons, which break url(#…)
  const small = size <= 24;
  const ew = small ? 12.4 : 8.5;
  const eh = small ? 18.7 : 17;
  const aw = ew * 1.15; // closed-eye arc width
  const ay = EYE_Y + eh * 0.12;

  return (
    <svg
      className={`mascot ${state} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <defs>
        <radialGradient id={`mg${id}`} cx="34%" cy="28%" r="80%">
          <stop offset="0" className="mc-stop-hi" />
          <stop offset="0.55" className="mc-stop-mid" />
          <stop offset="1" className="mc-stop-lo" />
        </radialGradient>

        <mask id={`mb${id}`}>
          <rect width="100" height="100" fill="#fff" />
          <circle cx={small ? 82 : 84} cy={small ? 20 : 19} r={small ? 25 : 22} fill="#000" />
        </mask>
      </defs>
      <g className="mc-body">
        <g mask={`url(#mb${id})`}>
          <circle cx="50" cy="53" r="42" fill={`url(#mg${id})`} />
          {!small && (
            <>
              <circle className="mc-crater" cx="27" cy="76" r="5" />
              <circle className="mc-crater" cx="66" cy="81" r="3" />
            </>
          )}
        </g>
        <g className="mc-eyes">
          <g className="mc-open">
            {EYE_X.map((x) => (
              <rect key={x} x={x - ew / 2} y={EYE_Y - eh / 2} width={ew} height={eh} rx={ew / 2} />
            ))}
          </g>
          <g className="mc-shut" strokeWidth={small ? 5 : 3.6}>
            {EYE_X.map((x) => (
              <path key={x} d={`M${x - aw / 2} ${ay} q${aw / 2} ${aw * 0.55} ${aw} 0`} />
            ))}
          </g>
          {state === 'pleased' && (
            <g className="mc-happy" strokeWidth={small ? 5 : 3.6}>
              {EYE_X.map((x) => (
                <path key={x} d={`M${x - aw / 2} ${ay + 2} q${aw / 2} ${-aw * 0.75} ${aw} 0`} />
              ))}
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
