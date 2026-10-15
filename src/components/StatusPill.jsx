/* Nocta — the one place system feedback lives, in both layouts: bringing in
 * last night after an SD card import, its "ready" beat, and confirmations
 * ("Summary ready", "Mask updated") ride one pill at the top of the page.
 * Priority: syncing > ready > toast. (On the old phone mockup this was the
 * Dynamic Island.) */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Icon } from './Icons.jsx';
import { Mascot } from './Mascot.jsx';

const READY_MS = 1700;

export function StatusPill() {
  const { syncing, syncNonce, syncInfo, toast } = useStore();
  const [ready, setReady] = useState(false);
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
        <Mascot size={26} state="asleep" />
        <span className="dstatus-text">
          <b>{syncInfo?.title ?? 'Bringing in last night'}</b>
          {syncInfo?.sub && <span>{syncInfo.sub}</span>}
        </span>
      </>
    );
  } else if (ready) {
    key = 'ready';
    content = (
      <>
        <Mascot size={22} state="waking" />
        <span className="dstatus-text">
          <b>Last night is ready</b>
        </span>
      </>
    );
  } else if (toast) {
    key = `toast-${toast.id}`;
    content = (
      <>
        <span className="dstatus-icon">
          <Icon name={toast.icon} size={14} />
        </span>
        <span className="dstatus-text">
          <b>{toast.text}</b>
        </span>
      </>
    );
  }

  return (
    <div className="dstatus-host" role="status" aria-live="polite">
      {content && (
        <div className="dstatus" key={key}>
          {content}
        </div>
      )}
    </div>
  );
}
