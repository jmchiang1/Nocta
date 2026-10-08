/* Nocta Coach — context-aware chat sheet. Mock replies, written to the safety rails. */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../lib/store.jsx';
import { SUGGESTED_PROMPTS, contextOpener, coachReply } from '../data/coach.js';
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

export function CoachSheet() {
  const { sheet, closeSheet } = useStore();
  const context = sheet.context;

  const [messages, setMessages] = useState(() => {
    const opener = contextOpener(context);
    return opener ? [{ role: 'coach', text: opener, stream: true }] : [];
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  // scroll only the sheet body — scrollIntoView would also scroll the page behind
  const pinToBottom = useCallback(() => {
    const scroller = bottomRef.current?.closest('.sheet-body');
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
  }, []);
  useEffect(pinToBottom, [messages, typing, pinToBottom]);

  function send(text) {
    const q = text.trim();
    if (!q || typing) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    const reply = coachReply(q);
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'coach', text: reply, stream: true }]);
      setTyping(false);
    }, 850);
  }

  const empty = messages.length === 0;

  return (
    <Sheet
      eyebrow="Nocta Coach"
      title="Ask anything"
      onClose={closeSheet}
      className="tall"
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
            aria-label="Message Nocta Coach"
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
              <Mascot size={64} />
            </div>
            <h4>Hi, I'm your Nocta Coach.</h4>
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

        {messages.map((m, i) =>
          m.role === 'coach' ? (
            <CoachMessage key={i} text={m.text} stream={m.stream} onTick={pinToBottom} />
          ) : (
            <div key={i} className="msg user">
              <div className="bubble user">
                <Rich text={m.text} />
              </div>
            </div>
          )
        )}

        {typing && (
          <div className="msg-row">
            <Mascot size={24} state="thinking" />
            <div className="typing" aria-label="Nocta is typing">
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
