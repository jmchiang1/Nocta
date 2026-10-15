/* Nocta — import CPAP data from a ResMed SD card. Used as a sheet from Therapy
 * (ImportSheet) and inside onboarding's "Bring in your CPAP data" step.
 *
 *   pick ── reading ─┬─ done (what was found, every night browsable;
 *                    │        a visible note if some files couldn't be read)
 *                    └─ error (not a card / Philips / empty / unreadable):
 *                             what happened, what to try ── pick again
 *
 * Parsing runs here, in the browser (lib/resmed); the result is kept on this
 * device (lib/importStore). Numbers are shown plainly — no good/bad colouring
 * of clinical metrics (CLAUDE.md safety rails). */
import { useState, useRef } from 'react';
import { useStore } from '../lib/store.jsx';
import { Icon } from '../components/Icons.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { parseCard, CardError } from '../lib/resmed/card.js';
import { entriesFromFileList, entriesFromDrop, canPickFolder } from '../lib/cardFiles.js';

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


const EVENT_LABEL = {
  osa: ['obstructive apnea', 'obstructive apneas'],
  csa: ['central apnea', 'central apneas'],
  hyp: ['hypopnea', 'hypopneas'],
  apnea: ['unclassified apnea', 'unclassified apneas'],
  arousal: ['arousal', 'arousals'],
};

/* naive 'YYYY-MM-DDTHH:MM:SS' → "1:15 AM" (wall clock, no time zones) */
const clock = (t) => {
  const [h, m] = t.slice(11, 16).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const dayLabel = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const hrs = (h) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;
const fmt = (v, unit = '') => (v == null ? '—' : `${v}${unit}`);

function eventSummary(events) {
  if (!events) return null;
  const parts = Object.entries(EVENT_LABEL)
    .filter(([k]) => events[k] > 0)
    .map(([k, [one, many]]) => `${events[k]} ${events[k] === 1 ? one : many}`);
  return parts.length ? parts.join(' · ') : 'No events recorded';
}

function NightRow({ night, open, onToggle }) {
  const detailed = night.source === 'datalog';
  return (
    <div className={`ci-night${open ? ' open' : ''}`}>
      <button className="list-row ci-night-head" aria-expanded={open} onClick={onToggle}>
        <div className="lr-main">
          <div className="lr-title">{dayLabel(night.date)}</div>
          <div className="lr-sub">
            {hrs(night.hours)}
            {night.sessions.length > 1 && ` · ${night.sessions.length} sessions`}
            {night.leak.p95 != null && ` · leak ${night.leak.p95} L/min`}
          </div>
        </div>
        <div className="ci-ahi">
          <span className="ci-ahi-k">AHI</span>
          <span className="ci-ahi-v tnum">{fmt(night.ahi.total)}</span>
        </div>
        <Icon name="chevronDown" size={16} className="ci-chev" />
      </button>

      {open && (
        <div className="ci-night-body">
          {detailed ? (
            <p className="ci-events-line">{eventSummary(night.events)}</p>
          ) : (
            <p className="ci-events-line">
              Summary only. The card no longer has this night’s event detail.
            </p>
          )}
          <dl className="ci-stats">
            <div>
              <dt>Pressure</dt>
              <dd className="tnum">
                {fmt(night.pressure.p50)} median · {fmt(night.pressure.p95)} at 95%
              </dd>
            </div>
            <div>
              <dt>Leak</dt>
              <dd className="tnum">
                {fmt(night.leak.p50)} median · {fmt(night.leak.p95)} at 95% (L/min)
              </dd>
            </div>
            {night.respRate?.p50 != null && (
              <div>
                <dt>Breathing rate</dt>
                <dd className="tnum">{night.respRate.p50} per minute</dd>
              </div>
            )}
            {night.spo2 && (
              <div>
                <dt>Oxygen</dt>
                <dd className="tnum">
                  {night.spo2.avg != null ? `${night.spo2.avg}% average` : `${night.spo2.median}% median`}
                  {night.spo2.min != null && ` · lowest ${night.spo2.min}%`}
                </dd>
              </div>
            )}
            <div>
              <dt>Mask on</dt>
              <dd className="tnum">
                {night.sessions.map((s) => `${clock(s.start)}–${clock(s.end)}`).join(', ') || '—'}
              </dd>
            </div>
          </dl>
          {detailed && night.eventList.length > 0 && (
            <ul className="ci-eventlist" aria-label="Events">
              {night.eventList.map((e, i) => (
                <li key={i}>
                  <span className="tnum">{clock(e.at)}</span>
                  <span>{EVENT_LABEL[e.type][0]}</span>
                  <span className="tnum">{e.durSec ? `${e.durSec}s` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE = 14;

function CardSummary({ card, result }) {
  const [openDate, setOpenDate] = useState(card.nights.at(-1)?.date ?? null);
  const [shown, setShown] = useState(PAGE);
  const nights = [...card.nights].reverse();
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
        . Saved on this phone only.
      </p>

      {/* up top, so a partial read is seen before the nights are trusted */}
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

      <div className="section-head">
        <h3>Nights</h3>
        <span className="meta">newest first</span>
      </div>
      <div className="list ci-nights">
        {nights.slice(0, shown).map((n) => (
          <NightRow
            key={n.date}
            night={n}
            open={openDate === n.date}
            onToggle={() => setOpenDate(openDate === n.date ? null : n.date)}
          />
        ))}
      </div>
      {shown < nights.length && (
        <button className="btn ghost ci-more" onClick={() => setShown(shown + PAGE * 4)}>
          Show older nights ({nights.length - shown} more)
        </button>
      )}


    </>
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

function Picker({ onEntries }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const folderOk = canPickFolder();

  return (
    <>
      <ol className="ci-steps">
        <li>Turn your machine off and take out the SD card. It’s on the side, under a flap.</li>
        <li>Put the card in your computer, or in a card reader.</li>
        <li>Choose the card below. Then put it back in the machine before bed.</li>
      </ol>

      <div
        className={`ci-drop${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          onEntries(await entriesFromDrop(e.dataTransfer));
        }}
      >
        <Icon name="download" size={22} />
        <span>Drop the card’s folder here</span>
        {folderOk && <span className="ci-drop-or">or</span>}
        {folderOk ? (
          <button className="btn primary ci-choose" onClick={() => inputRef.current?.click()}>
            Choose the SD card
          </button>
        ) : (
          <span className="ci-drop-or">
            This browser can’t open folders. Use Chrome, Safari or Firefox on a computer.
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          // folder picker: the whole card in one go
          webkitdirectory=""
          directory=""
          multiple
          tabIndex={-1}
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) onEntries(entriesFromFileList(list));
            e.target.value = '';
          }}
        />
      </div>
      <p className="settings-note ci-privacy">
        <Icon name="lock" size={14} /> Your card is read on this device. Nothing is uploaded.
      </p>
    </>
  );
}

/* the flow itself, without a frame — `onFinish(card)` when they're done */
export function CardImport({ onFinish, onCancel }) {
  const { cardData, saveCardImport, removeCardImport } = useStore();
  const [phase, setPhase] = useState(cardData ? 'done' : 'pick');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function run(entries) {
    setError(null);
    setPhase('reading');
    setProgress(null);
    try {
      const card = await parseCard(entries, { onProgress: setProgress });
      setResult(await saveCardImport(card));
      setPhase('done');
    } catch (err) {
      console.warn('[import]', err);
      setError(err instanceof CardError ? err.code : 'unreadable');
      setPhase('error');
    }
  }

  if (phase === 'reading') {
    return (
      <div className="ci-reading" aria-live="polite">
        <div className="si-working" aria-hidden="true">
          <span className="si-working-ring" />
          <img src="/Nocta-constellation-sm.svg" alt="" />
        </div>
        <h3>Reading your card…</h3>
        <p className="settings-note tnum">
          {progress ? `Night ${progress.done} of ${progress.total}` : 'Finding your nights'}
        </p>
        {progress && (
          <div className="ci-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
      </div>
    );
  }

  if (phase === 'done' && cardData) {
    return (
      <>
        <CardSummary card={cardData} result={result} />
        <div className="ci-actions">
          {onFinish && (
            <button className="btn primary" onClick={() => onFinish(cardData)}>
              Done
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() => {
              setResult(null);
              setPhase('pick');
            }}
          >
            Import a newer card
          </button>
          {!confirmRemove ? (
            <button className="btn subtle" onClick={() => setConfirmRemove(true)}>
              Remove imported data
            </button>
          ) : (
            <div className="confirm-row">
              <p className="confirm-text">
                Remove all {cardData.nights.length} imported nights from this phone? The card
                itself isn’t touched.
              </p>
              <div className="confirm-actions">
                <button className="btn ghost" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
                <button
                  className="btn destructive"
                  onClick={async () => {
                    await removeCardImport();
                    setConfirmRemove(false);
                    setResult(null);
                    setPhase('pick');
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  if (phase === 'error') {
    return <ErrorState code={error} onRetry={() => setPhase('pick')} onCancel={onCancel} />;
  }

  return <Picker onEntries={run} />;
}

/* Therapy › Import from SD card */
export function ImportSheet() {
  const { closeSheet } = useStore();
  return (
    <Sheet eyebrow="Your machine" title="Import from SD card" onClose={closeSheet} full>
      {(close) => <CardImport onFinish={close} onCancel={close} />}
    </Sheet>
  );
}
