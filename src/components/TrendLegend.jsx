/* Nocta — the key over each Trends chart. Every chart gets one (not just
 * AHI), so the four charts are the same height and each one says what its
 * lines mean: the 24 L/min leak line, the 4-hour use line, the shaded
 * prescribed pressure range. */

const ITEMS = {
  ahi: () => [
    { kind: 'bar', color: 'var(--alert)', label: 'Central' },
    { kind: 'bar', color: 'var(--data-deep)', label: 'Obstructive' },
    { kind: 'bar', color: 'var(--data-1)', label: 'Hypopnea' },
  ],
  leak: () => [
    { kind: 'line', color: 'var(--data-1)', label: 'Leak, 95th percentile' },
    { kind: 'dashed', label: '24 L/min' },
  ],
  hours: () => [
    { kind: 'bar', color: 'var(--data-1)', label: 'Hours on the mask' },
    { kind: 'dashed', label: '4 hours' },
  ],
  pressure: (rx) => [
    { kind: 'line', color: 'var(--data-1)', label: 'Median pressure' },
    ...(rx ? [{ kind: 'band', label: `Prescribed ${rx[0]}–${rx[1]}` }] : []),
  ],
};

/* `items` instead of `metric`: a one-off key ([{ kind, color?, label }]) */
export function TrendLegend({ metric, rx, items }) {
  return (
    <div className="legend trend-legend" aria-hidden="true">
      {(items ?? ITEMS[metric]?.(rx) ?? []).map((it) => (
        <span key={it.label}>
          <span className={`tl-key ${it.kind}`} style={it.color ? { '--c': it.color } : undefined} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
