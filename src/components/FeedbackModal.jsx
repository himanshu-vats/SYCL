import { useState } from 'react';

export default function FeedbackModal({ open, onClose }) {
  const [type, setType] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState(null);

  const page = (() => {
    try {
      const h = window.location.hash;
      if (h.startsWith('#player=')) return 'player:' + decodeURIComponent(h.slice(8));
      const path = window.location.pathname.replace(/^\//, '') || 'landing';
      return path;
    } catch { return 'unknown'; }
  })();

  const league = (() => {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      return parts[0] || null;
    } catch { return null; }
  })();

  const submit = () => {
    if (!message.trim()) return;
    setStatus('sending');
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, type, page, league, name }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => { setStatus('ok'); setMessage(''); setName(''); setTimeout(() => { onClose(); setStatus(null); }, 2000); })
      .catch(() => setStatus('err'));
  };

  const TYPES = [
    { id:'suggestion', label:'💡 Suggestion' },
    { id:'data_error', label:'📊 Data looks wrong' },
    { id:'bug',        label:'🐛 Something broken' },
    { id:'other',      label:'💬 Other' },
  ];

  if (!open) return null;

  return (
    <div className="fb-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fb-modal">
        <div className="fb-header">
          <span className="fb-title">Send Feedback</span>
          <button className="fb-close" onClick={onClose}>✕</button>
        </div>
        <div className="fb-body">
          {status === 'ok' ? (
            <div className="fb-success">Thanks! We got your feedback. 🙏</div>
          ) : (
            <>
              <div className="fb-field">
                <label className="fb-label">What kind of feedback?</label>
                <div className="fb-types">
                  {TYPES.map(t => (
                    <button key={t.id} className={`fb-type-btn${type === t.id ? ' active' : ''}`} onClick={() => setType(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fb-field">
                <label className="fb-label">Your feedback <span style={{color:'var(--accent)'}}>*</span></label>
                <textarea
                  className="fb-textarea"
                  placeholder="Tell us what you noticed, what you'd like to see, or what looks wrong..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="fb-field">
                <label className="fb-label">Your name <span style={{fontSize:11,color:'var(--text-muted)'}}>(optional)</span></label>
                <input className="fb-input" placeholder="e.g. Priya" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="fb-context">Sending from: <strong>{page}</strong></div>
              {status === 'err' && <div className="fb-error">Something went wrong — please try again.</div>}
              <button className="fb-submit" onClick={submit} disabled={!message.trim() || status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send Feedback'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
