/* Nocta Coach — context-aware chat sheet.
 *
 * Signed in: the real Nox. Each question goes to Claude with a summary of the
 * person's data (lib/nox.js → supabase/functions/nocta-nox) and the answer
 * streams in. Guests: the pre-written Nox (data/coach.js), keyword-matched
 * replies written to the same safety rails, with a note that signing in
 * gets the smart version. */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../lib/store.jsx';
import { SUGGESTED_PROMPTS, contextOpener, coachReply } from '../data/coach.js';
import { noxLiveFor, askNox } from '../lib/nox.js';
import { FIXTURES } from '../data/fixtures.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { Rich } from '../components/Rich.jsx';
import { useStreamedText } from '../lib/motion.jsx';

/* close any **bold** / *italic* marker left open mid-stream so the partial
 * text never flashes raw asterisks */
function balance(t) {
  let out = t;
  if ((out.match(/\*\*/g) || []).length % 2) out += '**';
  if ((out.replace(/\*\*/g, '').match(/\*/g) || []).length % 2) out += '*';
  return out;
}

/* a Coach reply arrives a few words at a time, like a model streaming —
 * the disclaimer footer settles in once the reply is complete */
function CoachMessage({ text, stream, onTick }) {
  const { text: shown, done } = useStreamedText(text, { enabled: stream });
  useEffect(() => {
    onTick();
  }, [shown, onTick]);
  return (
    <div className="msg coach">
      <div className="msg-row">
        <Mascot size={24} state={done ? 'still' : 'talking'} />
        <div className="bubble coach">
          <Rich text={balance(shown)} />
          {!done && <span className="caret" aria-hidden="true" />}
        </div>
      </div>
      {done && <span className="msg-foot">Observation, not medical advice</span>}
    </div>
  );
}

/* what the real Nox says when it can't answer */
const NOX_ERRORS = {
  daily_limit: 'You’ve asked me a lot today. I can take more questions tomorrow.',
  unauthorized: 'Your session ended. Sign in again and ask me once more.',
  refusal: 'I can’t help with that one. Ask me about your nights, your mask, or your numbers.',
  not_configured: 'The smart version of me isn’t switched on yet. Try again later.',
  failed: 'I couldn’t reach Nocta’s server just now. Try again in a moment.',
};

/* the chat so far, as Claude turns: strictly alternating, starting with the
 * person and ending with the new question. The opener and any failed answer
 * (with the question it failed on) are left out. */
function historyFor(messages, question) {
  const turns = [];
  for (const m of messages) {
    if (m.opener) continue;
    if (m.role === 'user') turns.push({ role: 'user', content: m.text });
    else if (m.live && !m.error && !m.pending && m.text) turns.push({ role: 'assistant', content: m.text });
  }
  turns.push({ role: 'user', content: question });
  const clean = [];
  for (const t of turns) {
    if (clean.length && clean.at(-1).role === t.role) clean.pop();
    clean.push(t);
  }
  const recent = clean.slice(-29);
  if (recent[0]?.role !== 'user') recent.shift();
  return recent;
}

/* a real Nox reply: grows as it streams; typing dots until the first words */
function LiveCoachMessage({ m, onTick }) {
  useEffect(() => {
    onTick();
  }, [m.text, m.pending, onTick]);
  if (m.pending && !m.text) {
    return (
      <div className="msg-row">
        <Mascot size={24} state="thinking" />
        <div className="typing" aria-label="Nox is typing">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  const paragraphs = m.text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className="msg coach">
      <div className="msg-row">
        <Mascot size={24} state={m.pending ? 'talking' : 'still'} />
        <div className="bubble coach">
          {paragraphs.map((p, i) => (
            <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>
              <Rich text={balance(p.trim())} />
            </p>
          ))}
          {m.pending && <span className="caret" aria-hidden="true" />}
        </div>
      </div>
      {!m.pending && !m.error && <span className="msg-foot">Observation, not medical advice</span>}
    </div>
  );
}

export function CoachSheet() {
  const { sheet, closeSheet, fixtureId, viewMode, authUser, authConfigured, switchToAccount } = useStore();
  // a signed-in account gets the real Nox; a guest gets the pre-written one
  const live = noxLiveFor(authUser);
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const context = sheet.context;
  // opened from a card, Nox starts with what you were looking at
  const [opener] = useState(() => contextOpener(context, FIXTURES[fixtureId]));

  const [messages, setMessages] = useState(() =>
    opener ? [{ role: 'coach', text: opener.text, stream: true, opener: true }] : []
  );
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  // scroll only the sheet body — scrollIntoView would also scroll the page behind
  const pinToBottom = useCallback(() => {
    const scroller = bottomRef.current?.closest('.sheet-body');
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, []);
  useEffect(pinToBottom, [messages, typing, pinToBottom]);

  /* replace the last message (the reply being written) */
  const patchLast = (fn) => setMessages((m) => [...m.slice(0, -1), fn(m.at(-1))]);

  async function sendLive(q) {
    const history = historyFor(messages, q);
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'coach', live: true, pending: true, text: '' }]);
    setInput('');
    setTyping(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await askNox(history, {
        context,
        fx: FIXTURES[fixtureId],
        signal: ctrl.signal,
        onText: (t) => patchLast((l) => ({ ...l, text: l.text + t })),
        // another model took over: its answer starts fresh
        onReset: () => patchLast((l) => ({ ...l, text: '' })),
      });
      patchLast((l) => ({ ...l, pending: false }));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      patchLast((l) => ({ ...l, pending: false, error: true, text: NOX_ERRORS[e.code] ?? NOX_ERRORS.failed }));
    } finally {
      setTyping(false);
    }
  }

  function send(text) {
    const q = text.trim();
    if (!q || typing) return;
    if (live) {
      sendLive(q);
      return;
    }
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    const reply = coachReply(q, FIXTURES[fixtureId]);
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'coach', text: reply, stream: true }]);
      setTyping(false);
    }, 850);
  }

  const empty = messages.length === 0;

  return (
    <Sheet
      eyebrow="Nox"
      title="Ask anything"
      onClose={closeSheet}
      className="tall coach-sheet"
      footer={
        <form
          className="coach-input"
          style={{ margin: '-14px -20px', padding: '14px 16px' }}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a metric or a night…"
            maxLength={500}
            aria-label="Message Nox"
          />
          <button type="submit" className="send" disabled={!input.trim() || typing} aria-label="Send">
            <Icon name="send" size={18} />
          </button>
        </form>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {empty && (
          <div className="coach-intro">
            <div className="ci-avatar">
              <Mascot size={64} pop sound={viewMode === 'desktop' ? undefined : 'land'} />
            </div>
            <h4>Hi, I'm Nox.</h4>
            <p>I read your CPAP data each night. Ask me what changed, or why.</p>
            <div className="suggest-row">
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button key={p} className="suggest" style={{ '--i': i }} onClick={() => send(p)}>
                  {p}
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* a guest is talking to the pre-written Nox: say what signing in gets */}
        {authConfigured && !live && (
          <div className="msg coach">
            <div className="msg-row">
              <Mascot size={24} state="still" />
              <div className="bubble coach">
                I’m the basic version of Nox, with answers written ahead of time. <strong>Sign in</strong> and I
                can answer real questions about your own nights.
              </div>
            </div>
            {/* same spot as the opener's follow-ups, without their 2 s wait */}
            <div className="suggest-row" style={{ margin: '2px 0 0 34px' }}>
              <button className="suggest" onClick={() => switchToAccount('signin')}>
                Sign in for the smart Nox
                <Icon name="chevronRight" size={15} />
              </button>
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.live ? (
            <LiveCoachMessage key={i} m={m} onTick={pinToBottom} />
          ) : m.role === 'coach' ? (
            <CoachMessage key={i} text={m.text} stream={m.stream} onTick={pinToBottom} />
          ) : (
            <div key={i} className="msg user">
              <div className="bubble user">
                <Rich text={m.text} />
              </div>
            </div>
          )
        )}

        {/* the opener's follow-ups, until you ask something */}
        {opener?.prompts && messages.length === 1 && !typing && (
          <div className="suggest-row after-opener">
            {opener.prompts.map((p, i) => (
              <button key={p} className="suggest" style={{ '--i': i }} onClick={() => send(p)}>
                {p}
                <Icon name="chevronRight" size={15} />
              </button>
            ))}
          </div>
        )}

        {typing && !live && (
          <div className="msg-row">
            <Mascot size={24} state="thinking" />
            <div className="typing" aria-label="Nox is typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </Sheet>
  );
}
