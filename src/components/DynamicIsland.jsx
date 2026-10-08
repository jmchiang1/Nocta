/* Nocta — Dynamic Island. Part of the phone hardware illusion, and the one
 * place system-level feedback lives: the morning SleepHQ sync expands it into
 * a live activity, and confirmations ("Summary ready", "Mask updated") ride it
 * instead of a separate toast banner. Priority: syncing > ready > toast. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Icon } from './Icons.jsx';
import { machineById } from '../data/therapy.js';
import { Mascot } from './Mascot.jsx';

const READY_MS = 1700;

export function DynamicIsland() {
  const { syncing, syncNonce, toast, machineId } = useStore();
  const [ready, setReady] = useState(false);
  // only a sync that *completes* while mounted shows "ready" — not a remount
  const seen = useRef(syncNonce);

  useEffect(() => {
    if (syncNonce === seen.current) return undefined;
    seen.current = syncNonce;
    setReady(true);
    const id = setTimeout(() => setReady(false), READY_MS);
    return () => clearTimeout(id);
  }, [syncNonce]);

  let content = null;
  let key = 'idle';
  if (syncing) {
    key = 'sync';
    content = (
      <>
        {/* the moon sleeps while last night comes in, and wakes when it lands */}
        <span className="di-lead mascot-lead">
          <Mascot size={38} state="asleep" />
        </span>
        <span className="di-text">
          <span className="di-title">Syncing last night</span>
          <span className="di-sub">SleepHQ · {machineById(machineId).short}</span>
        </span>
      </>
    );
  } else if (ready) {
    key = 'ready';
    content = (
      <>
        <span className="di-lead mascot-lead">
          <Mascot size={26} state="waking" />
        </span>
        <span className="di-text">
          <span className="di-title">Last night is ready</span>
        </span>
      </>
    );
  } else if (toast) {
    key = `toast-${toast.id}`;
    content = (
      <>
        <span className="di-lead info">
          <Icon name={toast.icon} size={15} />
        </span>
        <span className="di-text">
          <span className="di-title">{toast.text}</span>
        </span>
      </>
    );
  }

  const mode = syncing ? 'tall' : content ? 'wide' : '';

  return (
    <div className={`island ${mode}`} role="status" aria-live="polite">
      {content && (
        <div className="di-content" key={key}>
          {content}
        </div>
      )}
    </div>
  );
}
