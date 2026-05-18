/* Nocta — first-run onboarding. Intro + 10 screens + a one-time medical disclaimer.
 * See docs/FEATURES.md → Onboarding. Signup is deferred; pairing/health are mocked. */
import { useState, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Rich } from '../components/Rich.jsx';
import { Sheet } from '../components/Sheet.jsx';
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

/* ---- intro: a splash that morphs into the welcome screen ---- */

function Intro({ onDone }) {
  const [phase, setPhase] = useState('a');
  const welcome = phase === 'b';
  return (
    <div className="ob-intro">
      <div className="ob-intro-main">
        <img
          className={`ob-intro-logo ${welcome ? 'sm' : 'lg'}`}
          src="/Nocta-logo.svg"
          alt="Nocta"
        />
        <div className="ob-wordmark">Nocta</div>
        {welcome ? (
          <div className="ob-intro-welcome">
            <h1 className="ob-title">Sleep better, knowingly.</h1>
            <p className="ob-copy">
              Your CPAP machine records a lot every night. Nocta turns it into one clear,
              honest read on how you slept — and one thing worth trying.
            </p>
          </div>
        ) : (
          <div className="ob-intro-tag">Your CPAP nights, in plain language.</div>
        )}
      </div>
      <div className="ob-intro-foot">
        <button
          className="btn primary"
          onClick={() => (welcome ? onDone() : setPhase('b'))}
        >
          {welcome ? 'Continue' : 'Get started'}
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

/* full-width, single-column option list */
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
            className={`chip${sel ? ' selected' : ''}`}
            onClick={() => toggle(o)}
          >
            <span>{o.label}</span>
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
            <button className="ob-cond-main" onClick={() => toggle(o)}>
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
        Pick what matters most — Nocta will lead with the insights that fit. Choose as many
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
        Position matters — on your back and stomach the airway crowds more easily than on
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

function Health({ data, update, next }) {
  const [phase, setPhase] = useState(data.healthDevice ? 'done' : 'pick');
  const [device, setDevice] = useState(data.healthDevice);

  useEffect(() => {
    if (phase !== 'connecting') return undefined;
    const t = setTimeout(() => setPhase('done'), 1700);
    return () => clearTimeout(t);
  }, [phase]);

  const connect = (w) => {
    setDevice(w.label);
    update({ health: true, healthDevice: w.label });
    setPhase('connecting');
  };

  if (phase === 'connecting') {
    return (
      <Step center>
        <div className="ob-spinner" aria-hidden="true" />
        <h1 className="ob-title">Connecting…</h1>
        <p className="ob-copy">Pairing Nocta with your {device}.</p>
      </Step>
    );
  }

  if (phase === 'done') {
    return (
      <Step center foot={<button className="btn primary" onClick={next}>Continue</button>}>
        <div className="ob-connect-mark">
          <Icon name="check" size={30} />
        </div>
        <h1 className="ob-title">{device} connected</h1>
        <p className="ob-copy">
          Nocta will line your heart rate and sleep stages up against your therapy each
          night.
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
            <button key={w.id} className="chip" onClick={() => connect(w)}>
              <span>{w.label}</span>
              <Icon name="chevronRight" size={15} />
            </button>
          ))}
        </div>
      </div>
    </Step>
  );
}

function Pairing({ update, next }) {
  return (
    <Step
      foot={
        <>
          <button
            className="btn primary"
            onClick={() => {
              update({ sleephq: true });
              next();
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
      <h1 className="ob-title">Bring in your CPAP data</h1>
      <p className="ob-copy">
        Nocta reads your nightly therapy data through SleepHQ — it works with ResMed,
        Philips, and most modern machines.
      </p>
      <p className="ob-note">
        No SleepHQ account yet? Explore Nocta with sample data and connect whenever you're
        ready.
      </p>
    </Step>
  );
}

function Equipment({ data, update, next }) {
  const [brand, setBrand] = useState('');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = MASKS.filter(
    (m) =>
      (!brand || m.brand === brand) &&
      (!type || m.type === type) &&
      (!q ||
        m.name.toLowerCase().includes(q) ||
        BRAND_LABEL[m.brand].toLowerCase().includes(q))
  );

  return (
    <Step foot={<SkipFoot next={next} />}>
      <h1 className="ob-title">Your mask &amp; supplies</h1>
      <p className="ob-copy">
        Find the exact mask you use — Nocta tracks its parts and reminds you before they
        wear out.
      </p>

      <div className="ob-row" style={{ marginTop: 22 }}>
        <SelectInput
          filter
          placeholder="All brands"
          value={brand}
          onChange={setBrand}
          options={MASK_BRANDS}
        />
        <SelectInput
          filter
          placeholder="All types"
          value={type}
          onChange={setType}
          options={MASK_TYPES}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <TextInput placeholder="Search by model name" value={query} onChange={setQuery} />
      </div>

      <Field label={`Select your mask · ${results.length}`}>
        <div className="ob-mask-results">
          {results.length === 0 && (
            <div className="ob-mask-empty">No masks match those filters.</div>
          )}
          {results.map((m) => {
            const sel = data.maskModel === m.id;
            return (
              <button
                key={m.id}
                className={`ob-mask-row${sel ? ' selected' : ''}`}
                onClick={() => update({ maskModel: m.id })}
              >
                <span className="ob-mask-name">
                  {BRAND_LABEL[m.brand]} {m.name}
                </span>
                <span className="ob-mask-type">{TYPE_LABEL[m.type]}</span>
                {sel && <Icon name="check" size={16} />}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Mask size">
        <SelectInput
          placeholder="Select size"
          value={data.maskSize}
          onChange={(v) => update({ maskSize: v })}
          options={MASK_SIZES}
        />
      </Field>
      <Field label="Cushion last replaced">
        <ChipGroup
          options={CUSHION_AGE}
          value={data.cushion}
          onChange={(v) => update({ cushion: v })}
        />
      </Field>
    </Step>
  );
}

function Compliance({ data, update, next }) {
  return (
    <Step foot={<SkipFoot next={next} />}>
      <h1 className="ob-title">Insurance &amp; compliance</h1>
      <p className="ob-copy">
        Many insurers want proof of use — often 4+ hours on most nights for the first
        90 days. Nocta can track it so you don't have to.
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
          <div style={{ marginTop: 8 }}>
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
          <div style={{ marginTop: 8 }}>
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

function Expectations({ next }) {
  return (
    <Step foot={<button className="btn primary" onClick={next}>Got it</button>}>
      <h1 className="ob-title">Tomorrow morning</h1>
      <p className="ob-copy">
        After your first full night, you'll wake up to a card like this — what happened,
        why, and one thing to try. No 0–100 scores. No jargon.
      </p>
      <div className="ob-mini" aria-hidden="true">
        <div className="ob-mini-eyebrow">
          <Icon name="star" size={11} />
          Nocta Coach · Last night
        </div>
        <div className="ob-mini-title">
          <Rich text="Last night looked like your *usual baseline*." />
        </div>
        <p className="ob-mini-text">
          Your AHI held at 3.2, comfortably in range, and leak stayed low all night.
        </p>
        <div className="ob-mini-action">
          <Icon name="spark" size={14} />
          Nothing to change tonight — keep doing what you did.
        </div>
      </div>
    </Step>
  );
}

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
  Notifications,
];

function Disclaimer({ onAccept }) {
  return (
    <div className="ob-disclaimer">
      <div className="ob-disc-card">
        <div className="ob-disc-icon">
          <Icon name="shield" size={26} />
        </div>
        <h2>One important thing</h2>
        <p>
          Nocta is a wellness companion, not a medical device. It supplements — it does not
          replace — your prescribed CPAP therapy or your doctor's care.
        </p>
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
  const [disclaimer, setDisclaimer] = useState(false);
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
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : setDisclaimer(true));
  const back = () => setStep((s) => Math.max(0, s - 1));

  if (intro) return <Intro onDone={() => setIntro(false)} />;
  if (disclaimer) return <Disclaimer onAccept={completeOnboarding} />;

  const Current = STEPS[step];

  return (
    <div className="ob-screen">
      <StatusBar />
      <div className="ob-nav">
        {step > 0 ? (
          <button className="ob-back" onClick={back} aria-label="Back">
            <Icon name="chevronLeft" size={20} />
          </button>
        ) : (
          <span className="ob-back-spacer" />
        )}
        <div className="ob-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <span className="ob-back-spacer" />
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
