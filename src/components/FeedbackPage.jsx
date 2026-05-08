import { useState } from 'react';
import { MessageSquare } from 'lucide-react';

const TYPES = [
  { id: 'suggestion', label: '💡 Suggestion' },
  { id: 'data_error', label: '📊 Data looks wrong' },
  { id: 'bug',        label: '🐛 Something broken' },
  { id: 'other',      label: '💬 Other' },
];

export default function FeedbackPage({ slug }) {
  const [type,    setType]    = useState('suggestion');
  const [message, setMessage] = useState('');
  const [name,    setName]    = useState('');
  const [status,  setStatus]  = useState(null); // null | 'sending' | 'ok' | 'err'

  const page = (() => {
    try {
      const h = window.location.hash;
      if (h.startsWith('#player=')) return 'player:' + decodeURIComponent(h.slice(8));
      return window.location.pathname.replace(/^\//, '') || 'landing';
    } catch { return 'unknown'; }
  })();

  const submit = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const r = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message, type, page, league: slug, name }),
      });
      if (!r.ok) throw new Error();
      setStatus('ok');
      setMessage('');
      setName('');
    } catch {
      setStatus('err');
    }
  };

  const reset = () => { setStatus(null); setType('suggestion'); };

  return (
    <div className="feedback-page">
      <div className="feedback-page-header">
        <MessageSquare size={17} strokeWidth={1.8} className="feedback-page-icon" />
        <span className="feedback-page-title">Send Feedback</span>
      </div>

      <div className="feedback-page-body">
        {status === 'ok' ? (
          <div className="feedback-success">
            <div className="feedback-success-icon">🙏</div>
            <div className="feedback-success-title">Thanks for your feedback!</div>
            <div className="feedback-success-sub">We read every submission and use it to improve the portal.</div>
            <button className="fb-submit" style={{marginTop:20}} onClick={reset}>Send another →</button>
          </div>
        ) : (
          <div className="feedback-form">
            <div className="fb-field">
              <label className="fb-label">What kind of feedback?</label>
              <div className="fb-types">
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    className={`fb-type-btn${type === t.id ? ' active' : ''}`}
                    onClick={() => setType(t.id)}
                  >{t.label}</button>
                ))}
              </div>
            </div>

            <div className="fb-field">
              <label className="fb-label">Your feedback <span style={{color:'var(--accent)'}}>*</span></label>
              <textarea
                className="fb-textarea"
                placeholder="Tell us what you noticed, what you'd like to see, or what looks wrong…"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
              />
            </div>

            <div className="fb-field">
              <label className="fb-label">Your name <span style={{fontSize:11,color:'var(--text-muted)'}}>(optional)</span></label>
              <input
                className="fb-input"
                placeholder="e.g. your name or your child's name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="fb-context">Sending from: <strong>{page}</strong></div>

            {status === 'err' && (
              <div className="fb-error">Something went wrong — please try again.</div>
            )}

            <button
              className="fb-submit"
              onClick={submit}
              disabled={!message.trim() || status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Send Feedback'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
