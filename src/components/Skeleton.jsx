/* Nocta — loading placeholders shown while last night syncs from SleepHQ.
 * Shapes mirror Tonight as it is now: the open hero (headline + Nocta's moon,
 * the detail line, the night's horizon, the guiding-star suggestion), then the
 * soft section modules. Nothing jumps when the content lands. A slow shimmer
 * on the sky, never a spinner wall. */

function Bone({ w = '100%', h = 12, r = 6, style }) {
  return <span className="bone" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function TonightSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading last night">
      {/* hero: headline + moon, then the detail line */}
      <div className="sk-head">
        <div className="sk-head-text">
          <Bone w="82%" h={40} r={12} />
          <Bone w="54%" h={40} r={12} style={{ marginTop: 8 }} />
        </div>
        <Bone w={40} h={40} r={20} />
      </div>
      <Bone w="70%" h={14} r={7} style={{ marginTop: 14 }} />

      {/* the night's horizon: a soft hill that breathes while it loads */}
      <div className="sk-horizon" aria-hidden="true">
        <svg viewBox="0 0 390 150" preserveAspectRatio="none">
          <path d="M0 128 C70 126 92 104 128 70 C160 40 190 34 222 60 C258 90 300 116 390 122 L390 150 L0 150 Z" />
        </svg>
      </div>

      {/* the guiding-star suggestion */}
      <div className="sk-guide">
        <span className="sk-star" aria-hidden="true" />
        <div className="sk-guide-text">
          <Bone w={64} h={10} r={5} />
          <Bone w="88%" h={24} r={8} style={{ marginTop: 10 }} />
          <Bone w="62%" h={14} r={7} style={{ marginTop: 10 }} />
        </div>
      </div>

      {/* section modules */}
      <div className="sk-module">
        <Bone w="34%" h={14} r={7} />
        <div className="sk-row">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sk-metric">
              <Bone w="50%" h={9} />
              <Bone w="64%" h={22} r={6} style={{ marginTop: 10 }} />
              <Bone w="82%" h={9} style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="sk-module">
        <Bone w="28%" h={14} r={7} />
        <div className="sk-bars">
          {[0.2, 0.25, 0.4, 0.3, 0.7, 0.9, 0.8, 0.5, 0.3, 0.25, 0.2, 0.15].map((h, i) => (
            <span key={i} className="bone" style={{ height: `${h * 72}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
