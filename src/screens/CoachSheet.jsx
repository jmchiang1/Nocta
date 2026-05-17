/* Nocta Coach — context-aware chat sheet. Mock replies, written to the safety rails. */
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { SUGGESTED_PROMPTS, contextOpener, coachReply } from '../data/coach.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { Rich } from '../components/Rich.jsx';

export function CoachSheet() {
  const { sheet, closeSheet } = useStore();
  const context = sheet.context;

  const [messages, setMessages] = useState(() => {
    const opener = contextOpener(context);
    return opener ? [{ role: 'coach', text: opener }] : [];
  });
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  function send(text) {
    const q = text.trim();
    if (!q || typing) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    const reply = coachReply(q);
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'coach', text: reply }]);
      setTyping(false);
    }, 850);
  }

  const empty = messages.length === 0;

  return (
    <Sheet
      eyebrow="Nocta Coach"
      title="Ask anything"
      onClose={closeSheet}
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
              <Icon name="coach" size={22} />
            </div>
            <h4>Hi, I'm your Nocta Coach.</h4>
            <p>I read your CPAP data each night. Ask me what changed, or why.</p>
            <div className="suggest-row">
              {SUGGESTED_PROMPTS.map((p) => (
                <button key={p} className="suggest" onClick={() => send(p)}>
                  {p}
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={`bubble ${m.role}`}>
              <Rich text={m.text} />
            </div>
            {m.role === 'coach' && (
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '4px 0 0 4px' }}>
                Observation, not medical advice
              </span>
            )}
          </div>
        ))}

        {typing && (
          <div className="typing" aria-label="Nocta is typing">
            <span />
            <span />
            <span />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </Sheet>
  );
}
