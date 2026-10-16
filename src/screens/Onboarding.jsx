/* Nocta — first-run onboarding. Splash + 11 screens + a one-time medical disclaimer.
 * See docs/FEATURES.md → Onboarding. Signup is deferred until setup is done:
 *
 *   splash ─┬─ Get started ─── setup (11 steps) ── Save your setup (account) ── disclaimer ── welcome
 *           ├─ I already have an account ── sign in ── restore (screens/Returning.jsx)
 *           └─ Look around first ── disclaimer ── app on sample data (a guest:
 *                                   nothing is saved, so there's nothing to set up)
 *
 * Setup progress is kept on the device as it goes (DRAFT_KEY): Google sign-in
 * leaves the page and an email confirmation link may open in a new tab, and
 * neither should cost the person eleven steps. Pairing/health are mocked. */
import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { useStore } from '../lib/store.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Rich } from '../components/Rich.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { ConstellationReveal } from '../components/ConstellationReveal.jsx';
import { NightSky } from '../components/NightSky.jsx';
import { WhyHorizon } from '../components/WhyHorizon.jsx';
import { FIXTURES, EXAMPLE_FIXTURE } from '../data/fixtures.js';
import { prefersReducedMotion } from '../lib/motion.jsx';
import { MEDICAL_NOTE } from '../data/account.js';
import { Welcome } from './Welcome.jsx';
import { ReturningFlow } from './Returning.jsx';
import { saveOnboardingAnswers } from '../lib/profile.js';
import { AuthScreen, NewPassword } from './AuthScreen.jsx';
import { CardImport } from './CardImport.jsx';
import {
  Step,
  Working,
} from './onboardingParts.jsx';
import { AUTH_LANDING } from '../lib/auth.jsx';
import { PROVIDERS, accountName } from '../data/auth.js';
import { MeetCoach } from './MeetCoach.jsx';
import {
  GOALS,
  BIRTH_YEARS,
  SEX_OPTIONS,
  WEIGHTS,
  HEIGHT_FT,
  HEIGHT_IN,
  SLEEP_POSITIONS,
  SLEEP_CONDITIONS,
  COMPLIANCE_WINDOW,
  INSURERS,
  DME_PROVIDERS,
  WEARABLES,
  MASK_BRANDS,
  MASK_TYPES,
  MASK_SIZES,
  MASKS,
  CUSHION_AGE,
} from '../data/onboarding.js';

const BRAND_LABEL = Object.fromEntries(MASK_BRANDS.map((b) => [b.id, b.label]));
const TYPE_LABEL = Object.fromEntries(MASK_TYPES.map((t) => [t.id, t.label]));

/* ---- intro: a swirl that forms the logo, then settles into the welcome ----
 * 'swirl': the logo's constellation is found in the night sky — its stars
 *          light up one by one and join (ConstellationReveal).
 * 'dawn':  the logo glides up into a small lockup, a warm glow rises from the
 *          bottom, and the headline + CTA come in.
 * `settled` skips straight to dawn — coming back to the splash (signed out,
 * a cancelled sign-in) shouldn't replay the reveal. */

const HOLD_MS = 900; // a beat on the joined constellation before it rises to the top

// the splash lifts away (and its dawn glow sinks to the next screen's) before
// the next screen rises in — keep in step with .ob-intro.leaving in onboarding.css
const LEAVE_MS = 600;

function Intro({ settled, onStart, onGuest }) {
  const [phase, setPhase] = useState(() => (settled || prefersReducedMotion() ? 'dawn' : 'swirl'));
  const [leaving, setLeaving] = useState(false);
  const stageRef = useRef(null);
  const dawn = phase === 'dawn';

  // the sky stays; the splash's words and glow lift away, then hand off
  const leave = (fn) => {
    if (leaving) return;
    if (prefersReducedMotion()) return fn();
    setLeaving(true);
    setTimeout(fn, LEAVE_MS);
  };

  const resolved = useRef(false);
  const onResolve = () => {
    if (resolved.current) return;
    resolved.current = true;
    setTimeout(() => setPhase('dawn'), HOLD_MS);
  };

  return (
    <div
      ref={stageRef}
      className={`ob-intro ${phase}${settled ? ' settled' : ''}${leaving ? ' leaving' : ''}`}
    >
      <StatusBar />
      {/* a peek with sample data: no setup, nothing saved — small, up top,
       * level with the back button on the screens that follow */}
      <button className="ob-intro-peek" onClick={() => leave(onGuest)} tabIndex={dawn ? 0 : -1}>
        <span>Look around first</span>
      </button>
      <div className="ob-intro-dawn" aria-hidden="true" />
      <ConstellationReveal
        className="ob-intro-logo"
        stageRef={stageRef}
        onResolve={onResolve}
        handoff={dawn}
        settled={settled}
      />
      <span className="ob-intro-wordmark" aria-hidden="true">
        Nocta
      </span>
      <div className="ob-intro-main">
        <h1 className="ob-intro-title">
          <span>Sleep better,</span>
          <span className="ob-intro-accent">knowingly.</span>
        </h1>
        <p className="ob-intro-copy">
          Nocta turns your CPAP data into one clear read on last night, and one thing to try.
        </p>
      </div>
      {/* one decision here. Accounts are made at the end of setup (and signed
       * into on the next screen) — AuthScreen. Sign in with Apple returns there
       * before the App Store: guideline 4.8 requires it alongside Google. */}
      <div className="ob-intro-foot">
        <button className="btn primary" onClick={() => leave(() => onStart('signup'))} tabIndex={dawn ? 0 : -1}>
          Get started
        </button>
        <button
          className="btn subtle ob-intro-signin"
          onClick={() => leave(() => onStart('signin'))}
          tabIndex={dawn ? 0 : -1}
        >
          I already have an account
        </button>
      </div>
    </div>
  );
}

/* a step's title, with why-we-ask tucked behind an (i) beside it so every
 * screen fits without scrolling. The explanation opens as a small card over
 * the content (it doesn't push the answers down); tap again, tap outside or
 * press Escape to close it. */
function StepTitle({ title, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="ob-head" ref={ref}>
      <h1 className="ob-title">
        {title}
        <button
          type="button"
          className={`ob-title-info${open ? ' on' : ''}`}
          aria-label="Why we ask"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="info" size={20} />
        </button>
      </h1>
      {open && (
        <p id={id} className="ob-copy ob-tip" role="note">
          {children}
        </p>
      )}
    </div>
  );
}

/* ---- shared bits ---- */

function Field({ label, optional, children }) {
  return (
    <div className="ob-field">
      <div className="ob-field-label">
        {label}
        {optional && <span className="ob-optional"> · optional</span>}
      </div>
      {children}
    </div>
  );
}

/* the selection mark on an option card: a radio dot for single-choice,
 * a rounded checkbox for multi-choice */
const Tick = ({ on, multi }) => (
  <span className={`ob-tick${multi ? ' multi' : ''}${on ? ' on' : ''}`} aria-hidden="true">
    {on && <Icon name="check" size={13} />}
  </span>
);

/* full-width, single-column list of option cards */
export function ChipGroup({ options, value, onChange, multi }) {
  const on = (id) => (multi ? value.includes(id) : value === id);
  const toggle = (o) => {
    if (!multi) {
      onChange(value === o.id ? null : o.id);
      return;
    }
    if (value.includes(o.id)) {
      onChange(value.filter((x) => x !== o.id));
      return;
    }
    if (o.exclusive) {
      onChange([o.id]);
      return;
    }
    const cleaned = value.filter((x) => !options.find((op) => op.id === x)?.exclusive);
    onChange([...cleaned, o.id]);
  };
  return (
    <div className="ob-chips">
      {options.map((o) => {
        const sel = on(o.id);
        return (
          <button
            key={o.id}
            className={`ob-option${sel ? ' selected' : ''}`}
            aria-pressed={sel}
            onClick={() => toggle(o)}
          >
            <span>{o.label}</span>
            <Tick on={sel} multi={multi} />
          </button>
        );
      })}
    </div>
  );
}

/* multi-select list where each option has a tappable info tip */
function InfoChipGroup({ options, value, onChange, onInfo }) {
  const toggle = (o) => {
    if (value.includes(o.id)) {
      onChange(value.filter((x) => x !== o.id));
      return;
    }
    if (o.exclusive) {
      onChange([o.id]);
      return;
    }
    const cleaned = value.filter((x) => !options.find((op) => op.id === x)?.exclusive);
    onChange([...cleaned, o.id]);
  };
  return (
    <div className="ob-chips">
      {options.map((o) => {
        const sel = value.includes(o.id);
        return (
          <div key={o.id} className={`ob-cond-chip${sel ? ' selected' : ''}`}>
            <button className="ob-cond-main" aria-pressed={sel} onClick={() => toggle(o)}>
              <Tick on={sel} multi />
              <span>{o.label}</span>
            </button>
            {o.info && (
              <button
                className="ob-info-inline"
                aria-label={`About ${o.label}`}
                onClick={() => onInfo(o)}
              >
                <Icon name="info" size={17} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      className="ob-input"
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* `filter` makes the placeholder selectable (acts as an "All" reset) */
export function SelectInput({ value, onChange, options, placeholder, filter }) {
  return (
    <select
      className={`ob-select${value ? '' : ' empty'}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled={!filter}>
        {placeholder}
      </option>
      {options.map((o) => {
        const v = typeof o === 'object' ? (o.value ?? o.id) : o;
        const l = typeof o === 'object' ? o.label : o;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

/* Continue needs the step's main question answered; "Skip for now" is always
 * there. Every question is skippable (nothing here is needed to use Nocta),
 * and whatever's skipped comes back later as a gentle reminder
 * (lib/profile.js). An early tap on Continue says why instead of doing
 * nothing. */
function SkipFoot({ next, ready = true }) {
  const [nudged, setNudged] = useState(false);
  return (
    <>
      {nudged && !ready && (
        <p className="ob-foot-note ob-need" role="status">
          Pick an answer to continue, or skip for now.
        </p>
      )}
      <button
        className={`btn primary${ready ? '' : ' not-ready'}`}
        aria-disabled={!ready || undefined}
        onClick={() => (ready ? next() : setNudged(true))}
      >
        Continue
      </button>
      <button className="btn subtle" onClick={next}>
        Skip for now
      </button>
    </>
  );
}

/* ---- the screens ---- */

function Goals({ data, update, next }) {
  return (
    <Step foot={<SkipFoot next={next} ready={data.goals.length > 0} />}>
      <StepTitle title="What brings you here?">
        Pick what matters most and Nocta will lead with the insights that fit. Choose as many as you like.
      </StepTitle>
      <ChipGroup multi options={GOALS} value={data.goals} onChange={(v) => update({ goals: v })} />
    </Step>
  );
}

function AboutYou({ data, update, next }) {
  return (
    <Step foot={<SkipFoot next={next} ready={Boolean(data.birthYear && data.sex)} />}>
      <StepTitle title="A little about you">
        These help Nocta read your numbers against the right baseline.
      </StepTitle>
      <Field label="Birth year">
        <SelectInput
          placeholder="Select year"
          value={data.birthYear}
          onChange={(v) => update({ birthYear: v })}
          options={BIRTH_YEARS}
        />
      </Field>
      <Field label="Sex">
        <SelectInput
          placeholder="Select sex"
          value={data.sex}
          onChange={(v) => update({ sex: v })}
          options={SEX_OPTIONS}
        />
      </Field>
      <Field label="Weight" optional>
        <SelectInput
          placeholder="Select weight"
          value={data.weightLb}
          onChange={(v) => update({ weightLb: v })}
          options={WEIGHTS}
        />
      </Field>
      <Field label="Height" optional>
        <div className="ob-row">
          <SelectInput
            placeholder="Feet"
            value={data.heightFt}
            onChange={(v) => update({ heightFt: v })}
            options={HEIGHT_FT}
          />
          <SelectInput
            placeholder="Inches"
            value={data.heightIn}
            onChange={(v) => update({ heightIn: v })}
            options={HEIGHT_IN}
          />
        </div>
      </Field>
    </Step>
  );
}

function SleepingPosition({ data, update, next }) {
  return (
    <Step foot={<SkipFoot next={next} ready={Boolean(data.sleepPosition)} />}>
      <StepTitle title="How do you usually sleep?">
        Position matters. On your back and stomach, the airway crowds more easily than on your side.
      </StepTitle>
      <ChipGroup
        options={SLEEP_POSITIONS}
        value={data.sleepPosition}
        onChange={(v) => update({ sleepPosition: v })}
      />
    </Step>
  );
}

function SleepConditions({ data, update, next, onInfo }) {
  return (
    <Step foot={<SkipFoot next={next} ready={data.sleepConditions.length > 0} />}>
      <StepTitle title="Anything else affecting your sleep?">
        Other conditions help Nocta tell apart what's CPAP-related and what isn't. Tap the info icon if you're unsure what something means.
      </StepTitle>
      <InfoChipGroup
        options={SLEEP_CONDITIONS}
        value={data.sleepConditions}
        onChange={(v) => update({ sleepConditions: v })}
        onInfo={onInfo}
      />
    </Step>
  );
}

/* device → its app icon, for the connect steps (files in public/brands) */
const DEVICE_LOGO = {
  apple_watch: '/brands/applehealth.png', // Apple Watch data arrives through Apple Health
  oura: '/brands/oura.png',
  fitbit: '/brands/fitbit.svg',
  garmin: '/brands/garmin.svg',
  samsung: '/brands/samsung.svg',
  whoop: '/brands/whoop.png',
};

/* which wearable they have, if any. Nocta can't read wearables yet, so this
 * is a question, not a connection: nothing claims to be paired. */
const NO_WEARABLE = 'none';
function Health({ data, update, next }) {
  const pick = (id) => update({ healthDevice: data.healthDevice === id ? null : id });
  return (
    <Step foot={<SkipFoot next={next} ready={Boolean(data.healthDevice)} />}>
      <StepTitle title="Do you wear a watch or ring to bed?">
        Nocta can’t read wearables yet. Tell us which one you have, and we’ll let you know when it can line it up with your therapy.
      </StepTitle>
      <div className="ob-chips ob-stack-gap ob-wear">
        {WEARABLES.map((w) => {
          const sel = data.healthDevice === w.id;
          return (
            <button key={w.id} className={`ob-option${sel ? ' selected' : ''}`} aria-pressed={sel} onClick={() => pick(w.id)}>
              <img className="ob-option-logo" src={DEVICE_LOGO[w.id]} alt="" />
              <span className="ob-option-label">{w.label}</span>
              <Tick on={sel} />
            </button>
          );
        })}
        <button
          className={`ob-option${data.healthDevice === NO_WEARABLE ? ' selected' : ''}`}
          aria-pressed={data.healthDevice === NO_WEARABLE}
          onClick={() => pick(NO_WEARABLE)}
        >
          <span className="ob-option-label">I don’t wear one</span>
          <Tick on={data.healthDevice === NO_WEARABLE} />
        </button>
      </div>
    </Step>
  );
}

/* the CPAP data: the SD card is the only real way in today. (SleepHQ and
 * wearable connections come later; nothing here pretends to connect.) */
function Pairing({ data, update, next }) {
  const [importing, setImporting] = useState(false);
  const done = Boolean(data.cardNights);

  return (
    <>
      <Step
        foot={
          done ? (
            <button className="btn primary" onClick={next}>
              Continue
            </button>
          ) : (
            <>
              <button className="btn primary" onClick={() => setImporting(true)}>
                Import from SD card
              </button>
              <button className="btn subtle" onClick={next}>
                Use sample data for now
              </button>
            </>
          )
        }
      >
        <span className="ob-sd-tile" aria-hidden="true">
          <Icon name="download" size={28} />
        </span>
        <h1 className="ob-title">{done ? `${data.cardNights} nights imported` : 'Bring in your CPAP data'}</h1>
        <p className="ob-copy">
          {done
            ? 'Read from your SD card, on this device. You can import a newer card any time from Therapy.'
            : 'Import straight from your machine’s SD card. ResMed AirSense 10 and 11 cards work today. It’s read on this device; nothing is uploaded.'}
        </p>
      </Step>
      {importing && (
        <Sheet title="Import from SD card" onClose={() => setImporting(false)} full>
          {(close) => (
            <CardImport
              onCancel={close}
              onFinish={(card) => {
                update({ cardNights: card.nights.length });
                close();
                setTimeout(next, 320);
              }}
            />
          )}
        </Sheet>
      )}
    </>
  );
}

const TYPE_FILTERS = [{ id: '', label: 'All' }, ...MASK_TYPES];

/* one thing at a time: find the mask, then size and cushion appear */
function Equipment({ data, update, next }) {
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(!data.maskModel);
  const chosen = MASKS.find((m) => m.id === data.maskModel);

  const q = query.trim().toLowerCase();
  const results = MASKS.filter(
    (m) =>
      (!type || m.type === type) &&
      (!q ||
        m.name.toLowerCase().includes(q) ||
        BRAND_LABEL[m.brand].toLowerCase().includes(q))
  );

  const pick = (m) => {
    update({ maskModel: m.id });
    setPicking(false);
  };

  return (
    <Step foot={<SkipFoot next={next} ready={Boolean(data.maskModel && data.maskSize && data.cushion)} />}>
      <StepTitle title="Your mask & supplies">
        Find the mask you use. Nocta tracks its parts and reminds you before they wear out.
      </StepTitle>

      {picking || !chosen ? (
        <div className="ob-reveal" key="pick">
          <div className="ob-pills ob-filters" role="group" aria-label="Mask type">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.id || 'all'}
                className={`ob-pill${type === t.id ? ' on' : ''}`}
                aria-pressed={type === t.id}
                onClick={() => setType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ob-stack-gap">
            <TextInput placeholder="Search by name or brand" value={query} onChange={setQuery} />
          </div>
          <div className="ob-mask-results ob-stack-gap">
            {results.length === 0 && (
              <div className="ob-mask-empty">No masks match that search.</div>
            )}
            {results.map((m) => (
              <button
                key={m.id}
                className={`ob-mask-row${data.maskModel === m.id ? ' selected' : ''}`}
                onClick={() => pick(m)}
              >
                <span className="ob-mask-name">
                  {BRAND_LABEL[m.brand]} {m.name}
                </span>
                <span className="ob-mask-type">{TYPE_LABEL[m.type]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ob-reveal" key="chosen">
          <div className="ob-mask-chosen">
            <span className="ob-mask-chosen-text">
              <span className="ob-mask-name">
                {BRAND_LABEL[chosen.brand]} {chosen.name}
              </span>
              <span className="ob-mask-sub">{TYPE_LABEL[chosen.type]} mask</span>
            </span>
            <button className="ob-link" onClick={() => setPicking(true)}>
              Change
            </button>
          </div>
          <Field label="Size">
            <div className="ob-pills" role="group" aria-label="Mask size">
              {MASK_SIZES.map((s) => (
                <button
                  key={s.id}
                  className={`ob-pill${data.maskSize === s.id ? ' on' : ''}`}
                  aria-pressed={data.maskSize === s.id}
                  onClick={() => update({ maskSize: data.maskSize === s.id ? null : s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Cushion last replaced">
            <ChipGroup
              options={CUSHION_AGE}
              value={data.cushion}
              onChange={(v) => update({ cushion: v })}
            />
          </Field>
        </div>
      )}
    </Step>
  );
}

function Compliance({ data, update, next }) {
  // already cleared compliance: nothing for Nocta to track, so the insurer /
  // supplier questions lock (and drop any answers, so none get saved)
  const cleared = data.complianceWindow === 'no';
  return (
    <Step foot={<SkipFoot next={next} ready={Boolean(data.complianceWindow)} />}>
      <StepTitle title="Insurance & compliance">
        Many insurers want proof of use, often 4+ hours on at least 21 nights out of 30. Nocta can track it so you don't have to.
      </StepTitle>
      <Field label="Are you in a compliance window?">
        <ChipGroup
          options={COMPLIANCE_WINDOW}
          value={data.complianceWindow}
          onChange={(v) =>
            update(
              v === 'no'
                ? {
                    complianceWindow: v,
                    insuranceProvider: null,
                    insuranceOther: '',
                    equipmentProvider: null,
                    equipmentOther: '',
                  }
                : { complianceWindow: v }
            )
          }
        />
      </Field>
      {cleared && (
        <p className="ob-locked-note" role="status">
          <Icon name="lock" size={15} />
          You’ve already cleared compliance, so there’s nothing to track. You can skip the rest.
        </p>
      )}
      {/* a disabled fieldset locks every input inside it, keyboard included */}
      <fieldset className="ob-locked-group" disabled={cleared} aria-disabled={cleared || undefined}>
        <Field label="Insurance provider" optional>
          <SelectInput
            placeholder="Select your insurer"
            value={data.insuranceProvider}
            onChange={(v) => update({ insuranceProvider: v })}
            options={INSURERS}
          />
          {data.insuranceProvider === 'other_ins' && (
            <div className="ob-stack-gap">
              <TextInput
                placeholder="Enter your insurer"
                value={data.insuranceOther}
                onChange={(v) => update({ insuranceOther: v })}
              />
            </div>
          )}
        </Field>
        <Field label="Equipment / DME provider" optional>
          <SelectInput
            placeholder="Select your DME provider"
            value={data.equipmentProvider}
            onChange={(v) => update({ equipmentProvider: v })}
            options={DME_PROVIDERS}
          />
          {data.equipmentProvider === 'other_dme' && (
            <div className="ob-stack-gap">
              <TextInput
                placeholder="Enter your DME provider"
                value={data.equipmentOther}
                onChange={(v) => update({ equipmentOther: v })}
              />
            </div>
          )}
        </Field>
      </fieldset>
    </Step>
  );
}

/* the example card scales down to the room the step leaves it, so the step
 * never scrolls on a short screen (it's a picture of the card, not the card
 * to use). Its own height is unaffected by the transform, so this settles in
 * one pass; it re-fits when the window changes size. */
function useFitScale(innerRef, outerRef) {
  const [fit, setFit] = useState({ scale: 1, height: null });
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const outer = outerRef.current;
    const body = inner?.closest('.ob-body');
    const content = inner?.closest('.ob-content');
    if (!inner || !body || !content) return undefined;
    const measure = () => {
      const natural = inner.offsetHeight;
      const others = content.offsetHeight - outer.offsetHeight; // everything but the card
      const room = body.clientHeight - others - 12; // a little air above the footer
      const scale = Math.max(0.55, Math.min(1, room / natural));
      setFit({ scale, height: Math.round(natural * scale) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [innerRef, outerRef]);
  return fit;
}

/* the real why-card, played in like it will be tomorrow morning: the card
 * rises, the verdict arrives a word at a time, the night's bars grow in, then
 * the one action lands. Choreography lives in onboarding.css (.ob-why-stage). */
function Expectations({ next }) {
  // the same sky-first insight Tonight leads with (WhyHorizon), on a real night
  const example = FIXTURES[EXAMPLE_FIXTURE];
  const outer = useRef(null);
  const inner = useRef(null);
  const fit = useFitScale(inner, outer);
  return (
    <Step foot={<button className="btn primary" onClick={next}>Got it</button>}>
      <StepTitle title="Tomorrow morning">
        Each morning you'll wake up to this. Once Nocta knows your usual, it shows how last night compared. No 0–100 scores. No jargon.
      </StepTitle>
      <div className="ob-fit" ref={outer} style={fit.height ? { height: fit.height } : undefined}>
        <div
          className="ob-why-stage"
          ref={inner}
          style={fit.scale < 1 ? { transform: `scale(${fit.scale})`, transformOrigin: 'top center' } : undefined}
        >
          <span className="ob-example-tag">Example</span>
          <WhyHorizon
            insight={example.insight}
            timeline={example.timeline}
            session={example.session}
            usual={example.ahi.avgSoFar}
            fixtureId={EXAMPLE_FIXTURE}
          />
        </div>
      </div>
    </Step>
  );
}

const lockDate = () =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

function Notifications({ update, next }) {
  return (
    <Step
      foot={
        <>
          <button
            className="btn primary"
            onClick={() => {
              update({ notify: true });
              next();
            }}
          >
            Turn on reminders
          </button>
          <button className="btn subtle" onClick={next}>
            Maybe later
          </button>
        </>
      }
    >
      <StepTitle title="A gentle morning nudge">
        Want a quiet reminder to do your check-in each morning? It's the habit that makes Nocta's insights sharper over time.
      </StepTitle>
      <p className="ob-note">
        One nudge a day, never more. Reminders come from the iPhone app once it’s out; you can
        change this any time in Settings.
      </p>

      {/* what the nudge looks like: a Nocta notification on the lock screen */}
      <figure className="ob-lock" aria-label="Example: a Nocta reminder on your lock screen">
        <div className="ob-lock-date">{lockDate()}</div>
        <div className="ob-lock-time tnum">7:02</div>
        <div className="ob-notif">
          <span className="ob-notif-icon">
            <img src="/Nocta-constellation-sm.svg" alt="" />
          </span>
          <span className="ob-notif-body">
            <span className="ob-notif-head">
              <span>Nocta</span>
              <span>now</span>
            </span>
            <span className="ob-notif-title">Good morning</span>
            <span className="ob-notif-text">
              How did you sleep? Your morning check-in is ready.
            </span>
          </span>
        </div>
      </figure>
    </Step>
  );
}

const STEPS = [
  Goals,
  AboutYou,
  SleepingPosition,
  SleepConditions,
  Health,
  Pairing,
  Equipment,
  Compliance,
  Expectations,
  MeetCoach,
  Notifications,
];
function Disclaimer({ onAccept }) {
  return (
    <div className="ob-disclaimer">
      <div className="ob-disc-card">
        <img className="ob-disc-logo" src="/Nocta-constellation.svg" alt="" />
        <h2>One important thing</h2>
        <p>{MEDICAL_NOTE}</p>
        <button className="btn primary" onClick={onAccept}>
          I understand
        </button>
      </div>
    </div>
  );
}

/* ---- flow controller ---- */

export const DRAFT_KEY = 'nocta.setupDraft.v1';
const EMPTY_DATA = {
  goals: [],
  birthYear: null,
  sex: null,
  weightLb: null,
  heightFt: null,
  heightIn: null,
  sleepPosition: null,
  sleepConditions: [],
  healthDevice: null,
  cardNights: null,
  maskModel: null,
  maskSize: null,
  cushion: null,
  complianceWindow: null,
  insuranceProvider: null,
  insuranceOther: '',
  equipmentProvider: null,
  equipmentOther: '',
  notify: false,
};
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}
function saveDraft(draft) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function Onboarding() {
  const {
    completeOnboarding,
    authStatus,
    authUser,
    authPending,
    authError,
    authRecovery,
    authEntry,
    setAuthEntry,
    cancelSignIn,
    startAsGuest,
    signOutAuth,
    markOnboarded,
  } = useStore();

  // setup in progress (restored if a sign-in redirect reloaded the page)
  const draft = useRef(loadDraft()).current;
  const [started, setStarted] = useState(() => Boolean(draft) || authEntry === 'signup');
  const [step, setStep] = useState(draft?.step ?? 0);
  const [data, setData] = useState(() => ({ ...EMPTY_DATA, ...(draft?.data ?? {}) }));
  // the "Save your setup" account step, after the last setup step
  const [atAccount, setAtAccount] = useState(Boolean(draft?.atAccount));
  const [accountMode, setAccountMode] = useState('signup');

  // where you are follows who's signed in, and whether setup has begun:
  //   a guest → the disclaimer, then in · an account that finished setup
  //   before → Returning · a new account, or setup under way → setup · else the splash
  const route =
    authStatus === 'loading'
      ? 'loading'
      : authRecovery
        ? 'recovery'
        : authUser?.kind === 'guest'
          ? 'guest'
          : authUser?.returning
            ? 'returning'
            : authUser || started
              ? 'setup'
              : 'intro';
  const intro = route === 'intro';
  // true once the splash has played, so coming back to it doesn't replay the reveal
  const [introSeen, setIntroSeen] = useState(Boolean(draft));
  // a neutral hint on the sign-in screen (e.g. after "Used Nocta before?")
  const [introNote, setIntroNote] = useState(null);
  // the sign-in screen over the splash: null = the splash itself
  const [authMode, setAuthMode] = useState(() => (authEntry === 'signin' ? 'signin' : null));
  useEffect(() => {
    if (authEntry) setAuthEntry(null); // a one-shot hint from You › Account
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep setup progress on the device while it's under way
  useEffect(() => {
    saveDraft(started ? { step, data, atAccount } : null);
  }, [started, step, data, atAccount]);

  // signing out (from setup, the DevPanel, a lapsed session) starts over at
  // the splash — unless leaveSetup asked for the sign-in screen with a note
  const keepMode = useRef(false);
  const prevUser = useRef(authUser);
  useEffect(() => {
    if (prevUser.current && !authUser) {
      if (!keepMode.current) setAuthMode(null);
      keepMode.current = false;
    }
    prevUser.current = authUser;
  }, [authUser]);
  // a failed redirect (Google, an email link) lands where it can be explained:
  // the account step if setup was under way, else sign-in
  useEffect(() => {
    if (authError && !authMode && !started) {
      setIntroSeen(true);
      setAuthMode('signin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authError]);

  const [dir, setDir] = useState('fwd'); // which way the step content slides in
  const [disclaimer, setDisclaimer] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [infoTip, setInfoTip] = useState(null);

  // a NEW account got made at the end of setup (here, after a Google redirect,
  // or from an email link in another tab): on to the disclaimer. (An existing
  // account goes to Returning instead; if they back out of it, they're back
  // on this step with their answers intact.)
  useEffect(() => {
    if (atAccount && authUser && authUser.kind !== 'guest' && !authUser.returning) {
      setAtAccount(false);
      setDisclaimer(true);
    }
  }, [atAccount, authUser]);

  const update = (patch) => setData((d) => ({ ...d, ...patch }));
  const next = () => {
    setDir('fwd');
    if (step < STEPS.length - 1) setStep(step + 1);
    // already signed in (a new account that came in through sign-in): no account step
    else if (authUser) setDisclaimer(true);
    else setAtAccount(true);
  };
  const startSetup = () => {
    setIntroSeen(true);
    setIntroNote(null);
    setAuthMode(null);
    setStep(0);
    setData(EMPTY_DATA);
    setDir('rise'); // the first step rises in where the splash lifted away
    setStarted(true);
  };
  // leaving setup forgets it (and signs out a new account) — back to the splash
  const leaveSetup = (note = null) => {
    setIntroNote(note);
    keepMode.current = Boolean(note);
    setAuthMode(note ? 'signin' : null);
    setStarted(false);
    setAtAccount(false);
    setStep(0);
    setData(EMPTY_DATA);
    setDir('fwd');
    setDisclaimer(false);
    setWelcome(false);
    if (authUser) signOutAuth();
  };
  const back = () => {
    setDir('back');
    // back from the first step returns to the splash
    if (step === 0) leaveSetup();
    else setStep(step - 1);
  };
  const done = () => {
    setStarted(false);
    saveDraft(null);
    completeOnboarding();
  };
  const finish = () => {
    // keep what they told us (the insights use it; what they skipped comes
    // back later as a gentle reminder — lib/profile.js)
    saveOnboardingAnswers(data);
    markOnboarded();
    done();
  };

  // one night sky behind the whole flow, so it carries unbroken from the
  // splash through every step to the welcome (and on into Tonight's sky)
  // the splash and the welcome get the full show: more stars twinkling and
  // the occasional comet; the setup steps keep the sky calm
  const showcase = intro || welcome;
  const withSky = (screen) => (
    <div className="ob-root">
      {/* a fuller sky than Tonight's; the same density on every screen of the
       * flow, so the stars don't reshuffle between steps */}
      <NightSky condition="clear" density={2.4} twinkle={showcase ? 0.7 : 0.35} comets={showcase} />
      {screen}
    </div>
  );

  if (route === 'loading') {
    // back from Apple / Google: the sign-in finishes before anything shows
    return withSky(AUTH_LANDING ? <Working title="Signing you in…" /> : null);
  }

  const providerPending = authPending === 'apple' || authPending === 'google';
  if (!authUser && providerPending) {
    const label = PROVIDERS[authPending].label;
    return withSky(
      <div className="ob-screen fwd">
        <div className="ob-ambient" aria-hidden="true" />
        <StatusBar />
        <Working
          title={`Signing in with ${label}…`}
          copy={`Finish in the ${label} window. Nocta only gets your name and email.`}
          foot={
            <button className="btn subtle" onClick={cancelSignIn}>
              Cancel
            </button>
          }
        />
      </div>
    );
  }

  // back from a reset-password link: a new password first
  if (route === 'recovery') {
    return withSky(<NewPassword onCancel={() => leaveSetup()} />);
  }

  // "I already have an account": sign in. Its "Create an account" starts setup,
  // since accounts are made at the end of it.
  if (intro && authMode) {
    return withSky(
      <AuthScreen
        mode={authMode}
        enter="rise"
        note={introNote}
        onMode={(m) => (m === 'signup' ? startSetup() : setAuthMode(m))}
        onBack={() => {
          setIntroNote(null);
          setAuthMode(null);
        }}
      />
    );
  }

  if (intro) {
    return withSky(
      <Intro
        settled={introSeen}
        onStart={(m) => {
          if (m === 'signup') startSetup();
          else {
            setIntroSeen(true);
            setAuthMode(m);
          }
        }}
        onGuest={() => {
          setIntroSeen(true);
          startAsGuest();
        }}
      />
    );
  }
  // a guest: nothing to set up or save — the one-time disclaimer, then in
  if (route === 'guest') return withSky(<Disclaimer onAccept={done} />);
  // an existing account: restore, then straight to Tonight
  if (route === 'returning') {
    return withSky(
      <ReturningFlow
        onExit={() => {
          setIntroSeen(true);
          signOutAuth();
        }}
        onDone={done}
      />
    );
  }
  // the end of setup: make the account that keeps it
  if (atAccount && !authUser) {
    return withSky(
      <AuthScreen
        mode={accountMode}
        onMode={setAccountMode}
        onBack={() => {
          setDir('back');
          setAtAccount(false);
        }}
        title="Save your setup"
        copy="Make an account so your answers and nights are kept, and follow you to a new phone."
      />
    );
  }
  // first run ends on a welcome moment, then hands off to the home screen
  if (welcome) {
    return withSky(
      <Welcome data={data} onDone={finish} />
    );
  }
  if (disclaimer) return withSky(<Disclaimer onAccept={() => setWelcome(true)} />);

  const Current = STEPS[step];

  return withSky(
    <div className={`ob-screen ${dir}`}>
      <div className="ob-ambient" aria-hidden="true" />
      <StatusBar />
      <div className="ob-nav">
        <button className="ob-back" onClick={back} aria-label="Back">
          <Icon name="chevronLeft" size={20} />
        </button>
        <div
          className="ob-progress"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <span className="ob-count tnum">
          {step + 1}/{STEPS.length}
        </span>
      </div>
      {/* a brand-new account: say whose it is, in case they meant to sign
       * in to one they already have (e.g. Apple vs the Google they used) */}
      {step === 0 && (authUser?.kind === 'apple' || authUser?.kind === 'google') && (
        <div className="ob-account-note">
          <span className="ob-account-text">
            New account for
            <strong className="ob-account-email">
              {accountName(authUser)}
            </strong>
          </span>
          <button
            className="ob-link"
            onClick={() =>
              leaveSetup('Sign in with the Apple or Google account you used the first time.')
            }
          >
            Used Nocta before?
          </button>
        </div>
      )}
      <Current key={step} data={data} update={update} next={next} onInfo={setInfoTip} />
      {infoTip && (
        <Sheet
          eyebrow="Sleep condition"
          title={infoTip.label}
          onClose={() => setInfoTip(null)}
        >
          <p className="ob-tip-body">{infoTip.info}</p>
        </Sheet>
      )}
    </div>
  );
}
