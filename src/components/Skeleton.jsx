/* Nocta — loading placeholders shown while last night syncs from SleepHQ.
 * Shapes mirror the real cards (why-card, AHI, metrics row, night chart) so
 * nothing jumps when the content lands. A slow shimmer, never a spinner wall. */

function Bone({ w = '100%', h = 12, r = 6, style }) {
  return <span className="bone" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function TonightSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading last night">
      <div className="sk-card sk-why">
        <Bone w="78%" h={26} r={8} />
        <Bone w="52%" h={26} r={8} style={{ marginTop: 10 }} />
        <div className="sk-bars">
          {[0.2, 0.25, 0.4, 0.3, 0.7, 0.9, 0.8, 0.5, 0.3, 0.25, 0.2, 0.15].map((h, i) => (
            <span key={i} className="bone" style={{ height: `${h * 32}px` }} />
          ))}
        </div>
        <Bone h={64} r={16} style={{ marginTop: 20 }} />
        <Bone w="60%" h={12} style={{ marginTop: 18 }} />
      </div>

      <Bone w="34%" h={16} style={{ margin: '4px 4px 14px' }} />
      <div className="sk-card sk-ahi">
        <Bone w="42%" h={10} />
        <Bone w="38%" h={54} r={10} style={{ marginTop: 12 }} />
        <Bone h={18} r={9} style={{ marginTop: 22 }} />
      </div>

      <div className="sk-row">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk-card sk-metric">
            <Bone w="50%" h={9} />
            <Bone w="60%" h={22} r={6} style={{ marginTop: 10 }} />
            <Bone w="80%" h={9} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
