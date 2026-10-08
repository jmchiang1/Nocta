/* Nocta — first-run onboarding. Intro + 10 screens + a one-time medical disclaimer.
 * See docs/FEATURES.md → Onboarding. Signup is deferred; pairing/health are mocked. */
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Rich } from '../components/Rich.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { ConstellationReveal } from '../components/ConstellationReveal.jsx';
import { NightSky } from '../components/NightSky.jsx';
import { WhyHorizon } from '../components/WhyHorizon.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { prefersReducedMotion } from '../lib/motion.jsx';
import { MEDICAL_NOTE } from '../data/account.js';
import { Welcome } from './Welcome.jsx';
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
 *          bottom, and the headline + CTA come in. */

const HOLD_MS = 900; // a beat on the joined constellation before it rises to the top

function Intro({ onDone }) {
  const [phase, setPhase] = useState(() => (prefersReducedMotion() ? 'dawn' : 'swirl'));
  const stageRef = useRef(null);
  const dawn = phase === 'dawn';

  const resolved = useRef(false);
  const onResolve = () => {
    if (resolved.current) return;
    resolved.current = true;
    setTimeout(() => setPhase('dawn'), HOLD_MS);
  };

  return (
    <div ref={stageRef} className={`ob-intro ${phase}`}>
      <StatusBar />
      <div className="ob-intro-dawn" aria-hidden="true" />
      <ConstellationReveal
        className="ob-intro-logo"
        stageRef={stageRef}
        onResolve={onResolve}
        handoff={dawn}
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
          Your CPAP machine records a lot every night. Nocta turns it into one clear, honest
          read on how you slept, plus one thing worth trying.
        </p>
      </div>
      <div className="ob-intro-foot">
        <button className="btn primary" onClick={onDone} tabIndex={dawn ? 0 : -1}>
          Get started
        </button>
      </div>
    </div>
  );
}

/* ---- shared bits ---- */

function Field({ label, children }) {
  return (
    <div className="ob-field">
      <div className="ob-field-label">{label}</div>
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
function ChipGroup({ options, value, onChange, multi }) {
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
function SelectInput({ value, onChange, options, placeholder, filter }) {
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

function Step({ children, foot, center }) {
  return (
    <>
      <div className="ob-body">
        <div className={`ob-content${center ? ' center' : ''}`}>{children}</div>
      </div>
      {foot && <div className="ob-foot">{foot}</div>}
    </>
  );
}

const SkipFoot = ({ next, label = 'Skip' }) => (
  <>
    <button className="btn primary" onClick={next}>
      Continue
    </button>
    <button className="btn subtle" onClick={next}>
      {label}
    </button>
  </>
);

/* ---- the screens ---- */

function Goals({ data, update, next }) {
  return (
    <Step foot={<SkipFoot next={next} label="Skip for now" />}>
      <h1 className="ob-title">What brings you here?</h1>
      <p className="ob-copy">
        Pick what matters most and Nocta will lead with the insights that fit. Choose as many
        as you like.
      </p>
      <ChipGroup multi options={GOALS} value={data.goals} onChange={(v) => update({ goals: v })} />
    </Step>
  );
}

function AboutYou({ data, update, next }) {
  return (
    <Step foot={<SkipFoot next={next} />}>
      <h1 className="ob-title">A little about you</h1>
      <p className="ob-copy">
        These help Nocta read your numbers against the right baseline. All optional.
      </p>
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
      <Field label="Weight">
        <SelectInput
          placeholder="Select weight"
          value={data.weightLb}
          onChange={(v) => update({ weightLb: v })}
          options={WEIGHTS}
        />
      </Field>
      <Field label="Height">
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
    <Step foot={<SkipFoot next={next} />}>
      <h1 className="ob-title">How do you usually sleep?</h1>
      <p className="ob-copy">
        Position matters. On your back and stomach, the airway crowds more easily than on
        your side.
      </p>
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
    <Step foot={<SkipFoot next={next} />}>
      <h1 className="ob-title">Anything else affecting your sleep?</h1>
      <p className="ob-copy">
        Other conditions help Nocta tell apart what's CPAP-related and what isn't. Tap the
        info icon if you're unsure what something means.
      </p>
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
const SLEEPHQ_LOGO = '/brands/sleephq.png';
const CONNECT_MS = 1700;

/* Nocta ··· partner, joined by a link that pulses while connecting and
 * draws solid once connected */
function PairVisual({ logo, state }) {
  return (
    <div className={`ob-pair ${state}`} aria-hidden="true">
      <span className="ob-pair-tile nocta">
        <img src="/Nocta-constellation-sm.svg" alt="" />
      </span>
      <span className="ob-pair-link">
        <i />
        <i />
        <i />
      </span>
      <span className="ob-pair-tile brand">
        <img src={logo} alt="" />
      </span>
    </div>
  );
}

/* the shared pick → connecting → connected rhythm of the two connect steps */
function useConnect(alreadyConnected) {
  const [phase, setPhase] = useState(alreadyConnected ? 'done' : 'pick');
  useEffect(() => {
    if (phase !== 'connecting') return undefined;
    const t = setTimeout(() => setPhase('done'), CONNECT_MS);
    return () => clearTimeout(t);
  }, [phase]);
  return [phase, () => setPhase('connecting')];
}

function Health({ data, update, next }) {
  const [phase, start] = useConnect(Boolean(data.healthDevice));
  const device = WEARABLES.find((w) => w.label === data.healthDevice);

  const connect = (w) => {
    update({ health: true, healthDevice: w.label });
    start();
  };

  if (phase !== 'pick' && device) {
    const done = phase === 'done';
    return (
      <Step
        center
        foot={
          done && (
            <button className="btn primary" onClick={next}>
              Continue
            </button>
          )
        }
      >
        <PairVisual logo={DEVICE_LOGO[device.id]} state={done ? 'done' : 'connecting'} />
        <h1 className="ob-title">{done ? `${device.label} connected` : 'Connecting…'}</h1>
        <p className="ob-copy">
          {done
            ? 'Nocta will line your heart rate and sleep stages up against your therapy each night.'
            : `Pairing Nocta with your ${device.label}.`}
        </p>
      </Step>
    );
  }

  return (
    <Step foot={<button className="btn subtle" onClick={next}>Not now</button>}>
      <h1 className="ob-title">Connect your health data</h1>
      <p className="ob-copy">
        Wear a watch or ring? Connect it so Nocta can see your heart rate and sleep stages
        alongside your therapy.
      </p>
      <div className="ob-field">
        <div className="ob-field-label">Choose a device</div>
        <div className="ob-chips">
          {WEARABLES.map((w) => (
            <button key={w.id} className="ob-option" onClick={() => connect(w)}>
              <img className="ob-option-logo" src={DEVICE_LOGO[w.id]} alt="" />
              <span className="ob-option-label">{w.label}</span>
              <Icon name="chevronRight" size={18} />
            </button>
          ))}
        </div>
      </div>
    </Step>
  );
}

function Pairing({ data, update, next }) {
  const [phase, start] = useConnect(data.sleephq);

  if (phase !== 'pick') {
    const done = phase === 'done';
    return (
      <Step
        center
        foot={
          done && (
            <button className="btn primary" onClick={next}>
              Continue
            </button>
          )
        }
      >
        <PairVisual logo={SLEEPHQ_LOGO} state={done ? 'done' : 'connecting'} />
        <h1 className="ob-title">{done ? 'SleepHQ connected' : 'Connecting…'}</h1>
        <p className="ob-copy">
          {done
            ? "Each morning, Nocta will bring in last night's therapy data from SleepHQ."
            : 'Signing in to SleepHQ.'}
        </p>
      </Step>
    );
  }

  return (
    <Step
      foot={
        <>
          <p className="ob-foot-note">
            No SleepHQ account yet? Explore Nocta with sample data and connect whenever
            you're ready.
          </p>
          <button
            className="btn primary"
            onClick={() => {
              update({ sleephq: true });
              start();
            }}
          >
            Connect SleepHQ
          </button>
          <button className="btn subtle" onClick={next}>
            Use sample data for now
          </button>
        </>
      }
    >
      <PairVisual logo={SLEEPHQ_LOGO} state="idle" />
      <h1 className="ob-title">Bring in your CPAP data</h1>
      <p className="ob-copy">
        Nocta reads your nightly therapy data through SleepHQ. It works with ResMed,
        Philips, and most modern machines.
      </p>
    </Step>
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
    <Step foot={<SkipFoot next={next} />}>
      <h1 className="ob-title">Your mask &amp; supplies</h1>
      <p className="ob-copy">
        Find the mask you use. Nocta tracks its parts and reminds you before they wear out.
      </p>

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
  return (
    <Step foot={<SkipFoot next={next} />}>
      <h1 className="ob-title">Insurance &amp; compliance</h1>
      <p className="ob-copy">
        Many insurers want proof of use, often 4+ hours on at least 21 nights out of 30.
        Nocta can track it so you don't have to.
      </p>
      <Field label="Are you in a compliance window?">
        <ChipGroup
          options={COMPLIANCE_WINDOW}
          value={data.complianceWindow}
          onChange={(v) => update({ complianceWindow: v })}
        />
      </Field>
      <Field label="Insurance provider">
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
      <Field label="Equipment / DME provider">
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
    </Step>
  );
}

/* the real why-card, played in like it will be tomorrow morning: the card
 * rises, the verdict arrives a word at a time, the night's bars grow in, then
 * the one action lands. Choreography lives in onboarding.css (.ob-why-stage). */
function Expectations({ next }) {
  // the same sky-first insight Tonight leads with (WhyHorizon), on a real night
  const example = FIXTURES.anomaly;
  return (
    <Step foot={<button className="btn primary" onClick={next}>Got it</button>}>
      <h1 className="ob-title">Tomorrow morning</h1>
      <p className="ob-copy">
        Each morning you'll wake up to this. Once Nocta knows your usual, it shows how
        last night compared. No 0–100 scores. No jargon.
      </p>
      <div className="ob-why-stage">
        <span className="ob-example-tag">Example</span>
        <WhyHorizon
          insight={example.insight}
          timeline={example.timeline}
          session={example.session}
          usual={example.ahi.avgSoFar}
          fixtureId="anomaly"
        />
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
      <h1 className="ob-title">A gentle morning nudge</h1>
      <p className="ob-copy">
        Want a quiet reminder to do your 20-second check-in each morning? It's the habit
        that makes Nocta's insights sharper over time.
      </p>
      <p className="ob-note">One nudge a day, never more.</p>

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
              How did you sleep? Your 20-second check-in is ready.
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

export function Onboarding() {
  const { completeOnboarding } = useStore();
  const [intro, setIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState('fwd'); // which way the step content slides in
  const [disclaimer, setDisclaimer] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [infoTip, setInfoTip] = useState(null);
  const [data, setData] = useState({
    goals: [],
    birthYear: null,
    sex: null,
    weightLb: null,
    heightFt: null,
    heightIn: null,
    sleepPosition: null,
    sleepConditions: [],
    health: false,
    healthDevice: null,
    sleephq: false,
    maskModel: null,
    maskSize: null,
    cushion: null,
    complianceWindow: null,
    insuranceProvider: null,
    insuranceOther: '',
    equipmentProvider: null,
    equipmentOther: '',
    notify: false,
  });

  const update = (patch) => setData((d) => ({ ...d, ...patch }));
  const next = () => {
    setDir('fwd');
    if (step < STEPS.length - 1) setStep(step + 1);
    else setDisclaimer(true);
  };
  const back = () => {
    setDir('back');
    setStep((s) => Math.max(0, s - 1));
  };

  // one night sky behind the whole flow, so it carries unbroken from the
  // splash through every step to the welcome (and on into Tonight's sky)
  // the splash and the welcome get the full show: more stars twinkling and
  // the occasional comet; the setup steps keep the sky calm
  const showcase = intro || welcome;
  const withSky = (screen) => (
    <div className="ob-root">
      <NightSky condition="clear" twinkle={showcase ? 0.7 : 0.35} comets={showcase} />
      {screen}
    </div>
  );

  if (intro) return withSky(<Intro onDone={() => setIntro(false)} />);
  // first run ends on a welcome moment, then hands off to the home screen
  if (welcome) return withSky(<Welcome data={data} onDone={completeOnboarding} />);
  if (disclaimer) return withSky(<Disclaimer onAccept={() => setWelcome(true)} />);

  const Current = STEPS[step];

  return withSky(
    <div className={`ob-screen ${dir}`}>
      <div className="ob-ambient" aria-hidden="true" />
      <StatusBar />
      <div className="ob-nav">
        {step > 0 ? (
          <button className="ob-back glass" onClick={back} aria-label="Back">
            <Icon name="chevronLeft" size={20} />
          </button>
        ) : (
          <span className="ob-back-spacer" />
        )}
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
