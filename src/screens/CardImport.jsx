/* Nocta — import CPAP data from a ResMed SD card. Used as a sheet from Therapy
 * (ImportSheet) and inside onboarding's "Bring in your CPAP data" step.
 *
 *   pick ── reading ─┬─ read: straight back out (`onFinish`), every night
 *                    │        browsable — or, if some files couldn't be read,
 *                    │        the summary, with that note in plain sight
 *                    └─ error (not a card / Philips / empty / unreadable):
 *                             what happened, what to try ── pick again
 *
 * Reopened with a card in, it opens on that summary: import a newer card,
 * or remove what's there. The sheet's own × is the way out.
 *
 * Parsing runs here, in the browser (lib/resmed); the result is kept on this
 * device (lib/importStore). Numbers are shown plainly — no good/bad colouring
 * of clinical metrics (CLAUDE.md safety rails). */
import { noxHappy } from '../lib/sound.js';
import { prefersReducedMotion } from '../lib/motion.jsx';
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { Icon } from '../components/Icons.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { NoxThinking } from '../components/NoxThinking.jsx';
import { parseCard, CardError } from '../lib/resmed/card.js';
import { track } from '../lib/analytics.js';
import { entriesFromFileList, entriesFromDrop, canPickFolder, mergeEntries, cardContents } from '../lib/cardFiles.js';

/* the card couldn't be read: say what probably happened and what to try.
 * Calm, specific, never "Error". */
const ERRORS = {
  not_a_card: {
    title: 'That isn’t a CPAP card',
    body: 'Nocta couldn’t find any machine data in that folder.',
    tips: [
      'Choose the card itself, the top folder. It has a DATALOG folder and a file called STR.edf in it.',
      'If you copied the card to your computer first, choose the copied folder, not a folder inside it.',
    ],
  },
  philips: {
    title: 'Philips cards aren’t supported yet',
    body: 'That looks like a card from a Philips machine. Nocta reads ResMed AirSense 10 and 11 cards for now.',
    tips: ['Philips support is coming. Until then, you can look around with sample data.'],
  },
  empty: {
    title: 'No nights on this card yet',
    body: 'The card was read, but there’s no therapy on it.',
    tips: [
      'Put the card back in your machine and use it for a night. Then try again in the morning.',
      'A brand-new or just-formatted card starts empty.',
    ],
  },
  unreadable: {
    title: 'We couldn’t read this card',
    body: 'The files on it look damaged or incomplete.',
    tips: [
      'This usually happens when the card comes out while the machine is still saving. Put it back in, turn the machine on for a minute, then turn it off and try again.',
      'If it keeps happening, the card may be wearing out. Your equipment supplier can replace it.',
    ],
  },
};

const dayLabel = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

/* with an account, the card is saved to it too (lib/cloudSync.js) */
function useSynced() {
  const { authUser, authConfigured } = useStore();
  return Boolean(authConfigured && authUser && authUser.kind !== 'guest');
}

function CardSummary({ card, result }) {
  const synced = useSynced();
  const detailed = card.nights.filter((n) => n.source === 'datalog').length;
  const s = card.settings;
  const range =
    s?.minPressure != null && s?.maxPressure != null && s.mode !== 'CPAP'
      ? `${s.minPressure}–${s.maxPressure} cmH₂O`
      : s?.setPressure != null
        ? `${s.setPressure} cmH₂O`
        : null;

  return (
    <>
      <section className="ci-device">
        <span className="ci-device-icon" aria-hidden="true">
          <Icon name="therapy" size={20} />
        </span>
        <div>
          <h3>
            {card.device.brand} {card.device.model}
          </h3>
          <div className="ci-device-sub">
            {[s?.mode, range && `prescribed ${range}`, card.device.serial && `serial ···${card.device.serial.slice(-4)}`]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </section>

      <div className="ci-counts">
        <div>
          <span className="ci-count-v tnum">{card.nights.length}</span>
          <span className="ci-count-k">nights</span>
        </div>
        <div>
          <span className="ci-count-v tnum">{detailed}</span>
          <span className="ci-count-k">with full detail</span>
        </div>
        <div>
          <span className="ci-count-v">{dayLabel(card.range.last, { month: 'short', day: 'numeric' })}</span>
          <span className="ci-count-k">latest night</span>
        </div>
      </div>
      <p className="settings-note">
        {dayLabel(card.range.first, { month: 'short', day: 'numeric', year: 'numeric' })} to{' '}
        {dayLabel(card.range.last, { month: 'short', day: 'numeric', year: 'numeric' })}
        {result && (result.added ? `. ${result.added} new ${result.added === 1 ? 'night' : 'nights'} added` : '. Nothing new since your last import')}
        {synced ? '. Saved to your account, so it’s on all your devices.' : '. Saved on this device.'}
      </p>

      {/* a partial read is said plainly, with the files behind a tap */}
      {card.warnings?.length > 0 && (
        <details className="ci-warnings">
          <summary>
            <Icon name="info" size={16} />
            {card.warnings.length} {card.warnings.length === 1 ? 'file' : 'files'} couldn’t be read.
            Some nights may be missing or incomplete.
          </summary>
          <ul>
            {card.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

    </>
  );
}

/* "Remove data", asked once more before it goes */
function RemoveConfirm({ nights, onCancel, onRemove }) {
  const synced = useSynced();
  return (
    <section className="ci-confirm" aria-labelledby="ci-confirm-title">
      <h4 id="ci-confirm-title">Remove all {nights} nights?</h4>
      <p>
        They come off this device{synced ? ' and your account' : ''}. You can import your card again any
        time.
      </p>
      <div className="ci-confirm-actions">
        <button className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn destructive" onClick={onRemove}>
          Remove
        </button>
      </div>
    </section>
  );
}

function ErrorState({ code, onRetry, onCancel }) {
  const e = ERRORS[code] ?? ERRORS.unreadable;
  return (
    <div className="ci-failed" role="alert">
      <span className="ci-failed-icon" aria-hidden="true">
        <Icon name="info" size={24} />
      </span>
      <h3>{e.title}</h3>
      <p className="ci-failed-body">{e.body}</p>
      <ul className="ci-failed-tips">
        {e.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="ci-actions">
        <button className="btn primary" onClick={onRetry}>
          Choose the card again
        </button>
        {onCancel && (
          <button className="btn subtle" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* what's been picked so far, in plain words; ticks for what's in */
const PARTS = [
  { key: 'nights', label: 'Your nights', file: 'DATALOG folder', need: true },
  { key: 'summary', label: 'Daily summaries', file: 'STR.edf', need: true },
  { key: 'settings', label: 'Machine settings', file: 'SETTINGS folder' },
  { key: 'identity', label: 'Machine model', file: 'Identification file' },
];

/* Pick the whole card in one go (the folder button, or a drag of everything
 * on it), or build it up in pieces: each pick — a folder, or loose files like
 * STR.edf — adds to the checklist, and Read card goes when there's enough.
 * A pick that already holds a whole card is read straight away. */
function Picker({ onEntries }) {
  const folderRef = useRef(null);
  const filesRef = useRef(null);
  const [over, setOver] = useState(false);
  const [staged, setStaged] = useState([]);
  const folderOk = canPickFolder();
  const has = cardContents(staged);
  const enough = has.nights > 0 || has.summary;

  const add = (more) => {
    if (!more.length) return;
    const next = mergeEntries(staged, more);
    const c = cardContents(next);
    // a whole card (nights and summaries) in hand: no need to ask for more
    if (c.nights > 0 && c.summary) onEntries(next);
    else setStaged(next);
  };

  return (
    <>
      <ol className="ci-steps">
        <li>Turn your machine off and take out the SD card. It’s on the side, under a flap.</li>
        <li>Put the card in your computer, or in a card reader.</li>
        <li>
          Choose the card itself (it’s often called NO NAME). Or open it, select everything on it,
          and drag it all here. Then put the card back in the machine before bed.
        </li>
      </ol>

      {/* the drop area is the button: click (or Enter / Space) opens Finder on
       * the card; dropping works too */}
      <div
        className={`ci-drop${over ? ' over' : ''}${folderOk ? ' pickable' : ''}`}
        role={folderOk ? 'button' : undefined}
        tabIndex={folderOk ? 0 : undefined}
        aria-label={folderOk ? 'Drag your files into this box, or press to choose a single folder' : undefined}
        onClick={(e) => {
          // the hidden inputs live inside this box: their own click bubbles up
          // here, and must not open the folder dialog a second time
          if (e.target instanceof HTMLInputElement) return;
          if (folderOk) folderRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (folderOk && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            folderRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          add(await entriesFromDrop(e.dataTransfer));
        }}
      >
        <Icon name="download" size={24} />
        <span className="ci-drop-title">
          {staged.length ? 'Drag more files into this box' : 'Drag your files into this box'}
        </span>
        {folderOk && <span className="ci-drop-or">or click the box to choose a single folder</span>}
        {folderOk ? (
          // loose files (STR.edf, Identification…) need a files dialog: a quiet link
          <button
            type="button"
            className="ob-link ci-files-link"
            onClick={(e) => {
              e.stopPropagation();
              filesRef.current?.click();
            }}
          >
            Choose individual files instead
          </button>
        ) : (
          <span className="ci-drop-or">
            This browser can’t open folders. Use Chrome, Safari or Firefox on a computer.
          </span>
        )}
        {/* folders: the card, or DATALOG / SETTINGS (tip: inside the card with
         * nothing selected, the dialog's Upload button takes the whole card) */}
        <input
          ref={folderRef}
          type="file"
          className="sr-only"
          webkitdirectory=""
          directory=""
          multiple
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) add(entriesFromFileList(e.target.files));
            e.target.value = '';
          }}
        />
        {/* loose files: STR.edf, Identification.json, … (several at once) */}
        <input
          ref={filesRef}
          type="file"
          className="sr-only"
          multiple
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) add(entriesFromFileList(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {staged.length > 0 && (
        <section className="ci-staged" aria-label="What you’ve picked so far" aria-live="polite">
          <ul className="ci-checklist">
            {PARTS.map((p) => {
              const ok = p.key === 'nights' ? has.nights > 0 : has[p.key];
              return (
                <li key={p.key} className={ok ? 'ok' : ''}>
                  <span className="ci-check" aria-hidden="true">
                    {ok ? <Icon name="check" size={14} /> : null}
                  </span>
                  <span className="ci-check-label">
                    {p.label}
                    {p.key === 'nights' && has.nights > 0 && <span className="tnum"> · {has.nights}</span>}
                  </span>
                  <span className="ci-check-file">{ok ? 'added' : `${p.file}${p.need ? '' : ' · optional'}`}</span>
                </li>
              );
            })}
          </ul>
          {has.other > 0 && (
            <p className="settings-note ci-other">
              {has.other} {has.other === 1 ? 'file isn’t' : 'files aren’t'} part of a CPAP card and will be
              left out.
            </p>
          )}
          <div className="ci-staged-actions">
            <button className="btn ghost" disabled={!enough} onClick={() => onEntries(staged)}>
              {has.nights > 0 && has.summary ? 'Read card' : 'Read what I have'}
            </button>
            <button className="btn subtle" onClick={() => setStaged([])}>
              Start over
            </button>
          </div>
        </section>
      )}

    </>
  );
}

/* the flow itself, without a frame — `onFinish(card, result)` once a card
 * has been read cleanly */
/* reading a card takes at least this long on screen, so Nox's thinking
 * plays through and a small card doesn't flash past */
const MIN_READ_MS = 3000;
const CELEBRATE_MS = 1300; // Nox's happy hop before the result

export function CardImport({ onFinish, onCancel }) {
  const { cardData, saveCardImport, removeCardImport } = useStore();
  const [phase, setPhase] = useState(cardData ? 'done' : 'pick');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [justRead, setJustRead] = useState(false); // the result arrives (vs. reopening it)
  // the bar shows the slower of the real reading and the minimum time, so it
  // fills steadily rather than jumping to the end and waiting
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (phase !== 'reading') return undefined;
    const id = setInterval(() => setNow(performance.now()), 60);
    return () => clearInterval(id);
  }, [phase]);

  async function run(entries) {
    setError(null);
    setPhase('reading');
    setProgress(null);
    const t0 = performance.now();
    setStartedAt(t0);
    setNow(t0);
    track('card_import_started', { files: entries.length });
    try {
      const card = await parseCard(entries, { onProgress: setProgress });
      const saved = await saveCardImport(card);
      const left = MIN_READ_MS - (performance.now() - t0);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      setResult(saved);
      track('card_imported', { nights: saved.card.nights.length });
      // a beat for Nox to be pleased about it, then the result rises in
      setPhase('celebrate');
      noxHappy();
      await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 0 : CELEBRATE_MS));
      // read cleanly: nothing more to confirm, straight back out. A partial
      // read stays on the summary, so the files it missed are said plainly.
      if (onFinish && !card.warnings?.length) {
        onFinish(saved.card, saved);
        return;
      }
      setJustRead(true);
      setPhase('done');
    } catch (err) {
      console.warn('[import]', err);
      setError(err instanceof CardError ? err.code : 'unreadable');
      track('card_import_failed', { reason: err instanceof CardError ? err.code : 'unreadable' });
      setPhase('error');
    }
  }

  if (phase === 'reading') {
    const timeShare = Math.min(1, (now - startedAt) / MIN_READ_MS);
    const share = progress ? Math.min(progress.done / progress.total, timeShare) : 0;
    const night = progress ? Math.max(1, Math.round(share * progress.total)) : 0;
    return (
      <div className="ci-reading" aria-live="polite">
        <NoxThinking className="si-working" />
        <h3>Reading your card…</h3>
        <p className="settings-note tnum">{progress ? `Night ${night} of ${progress.total}` : 'Finding your nights'}</p>
        {progress && (
          <div className="ci-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={night}>
            <span style={{ width: `${share * 100}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (phase === 'celebrate') {
    const n = result?.card?.nights?.length ?? cardData?.nights?.length;
    return (
      <div className="ci-reading ci-celebrate" aria-live="polite">
        <NoxThinking className="si-working" done />
        <h3>All read</h3>
        <p className="settings-note tnum">{n ? `${n} nights` : 'Your nights are in'}</p>
      </div>
    );
  }

  if (phase === 'done' && cardData) {
    return (
      <div className={justRead ? 'ci-done-enter' : undefined}>
        <CardSummary card={cardData} result={result} />
        {confirmRemove ? (
          <RemoveConfirm
            nights={cardData.nights.length}
            onCancel={() => setConfirmRemove(false)}
            onRemove={async () => {
              await removeCardImport();
              setConfirmRemove(false);
              setResult(null);
              setPhase('pick');
            }}
          />
        ) : (
          <div className="ci-actions ci-done-actions">
            <button className="btn subtle" onClick={() => setConfirmRemove(true)}>
              Remove data
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setResult(null);
                setPhase('pick');
              }}
            >
              Import a newer card
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'error') {
    return <ErrorState code={error} onRetry={() => setPhase('pick')} onCancel={onCancel} />;
  }

  return <Picker onEntries={run} />;
}

/* what a clean import brought in, said on the way back to Tonight */
function importedNote({ card, added }) {
  if (added === card.nights.length) return `${added} ${added === 1 ? 'night' : 'nights'} imported`;
  if (added) return `${added} new ${added === 1 ? 'night' : 'nights'} added`;
  return 'No new nights on this card';
}

/* Therapy › Import from SD card (and Tonight's import prompts). A clean
 * read closes the sheet and lands on Tonight, on the newest night. */
export function ImportSheet() {
  const { closeSheet, setTab, showToast } = useStore();
  return (
    /* a page of its own on the phone (pushed in, Back to return), like the
     * sleep journal; a dialog on the desktop */
    <Sheet title="Import from SD card" onClose={closeSheet} variant="page">
      {(close) => (
        <CardImport
          onCancel={close}
          onFinish={(card, result) => {
            close();
            setTab('tonight');
            if (result) showToast(importedNote(result));
          }}
        />
      )}
    </Sheet>
  );
}
