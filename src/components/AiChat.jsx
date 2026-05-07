import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

const SUGGESTED = [
  "Who leads each division right now?",
  "Who are the top run scorers this season?",
  "Who are the best bowlers this season?",
  "What matches are coming up this weekend?",
];

function renderMessage(text) {
  return <span dangerouslySetInnerHTML={{ __html: marked.parse(text) }} />;
}

export default function AiChat({ slug }) {
  const [open,         setOpen]         = useState(false);
  const [phase,        setPhase]        = useState('intro'); // 'intro' | 'chat'
  const [name,         setName]         = useState('');
  const [role,         setRole]         = useState('parent');
  const [accessCode,   setAccessCode]   = useState('');
  const [sessionId]                     = useState(() => Math.random().toString(36).slice(2));
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [questionsLeft,setQuestionsLeft]= useState(20);
  const [error,        setError]        = useState('');
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (phase === 'chat') setTimeout(() => inputRef.current?.focus(), 100);
  }, [phase]);

  const startChat = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setPhase('chat');
    setMessages([{
      role: 'ai',
      content: `Hi ${name.trim()}! 🏏 I'm your SYCL Season Insight assistant. Ask me anything about the season — player stats, standings, upcoming matches, or how to improve your game!`,
    }]);
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content: q };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const resp = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          league:      slug,
          question:    q,
          sessionId,
          sessionInfo: { name: name.trim(), role, accessCode: accessCode.trim() },
          history:     messages.slice(-4), // last 2 exchanges
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 429) {
          setMessages(prev => [...prev, { role: 'ai', content: data.message || "Daily limit reached. Come back tomorrow! 🏏" }]);
          setQuestionsLeft(0);
        } else {
          throw new Error(data.error || 'Request failed');
        }
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: data.answer }]);
        if (data.questionsLeft !== undefined) setQuestionsLeft(data.questionsLeft);
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!slug) return null;

  return (
    <>
      {/* Floating button */}
      <button
        className={`chat-fab${open ? ' chat-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Ask AI"
        aria-label="Open AI chat"
      >
        {open ? <X size={20} strokeWidth={2} /> : <MessageCircle size={20} strokeWidth={2} />}
        {!open && <span className="chat-fab-label">Ask AI</span>}
      </button>

      {/* Panel */}
      {open && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-info">
              <span className="chat-header-title">✦ SYCL AI Assistant</span>
              {phase === 'chat' && (
                <span className="chat-header-sub">
                  {questionsLeft === 999 ? 'Unlimited' : `${questionsLeft} questions left today`}
                </span>
              )}
            </div>
            <button className="chat-close" onClick={() => setOpen(false)}><ChevronDown size={18} /></button>
          </div>

          {/* Intro form */}
          {phase === 'intro' && (
            <form className="chat-intro" onSubmit={startChat}>
              <div className="chat-intro-icon">🏏</div>
              <p className="chat-intro-text">
                Ask about player stats, standings, upcoming matches, or cricket improvement tips!
              </p>
              <div className="chat-field">
                <label className="chat-label">Your name</label>
                <input
                  className="chat-input-field"
                  placeholder="e.g. Aditya or Parent of Aditya"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="chat-field">
                <label className="chat-label">You are a…</label>
                <select className="chat-input-field" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="parent">Parent</option>
                  <option value="player">Player</option>
                  <option value="coach">Coach</option>
                  <option value="manager">Team Manager</option>
                </select>
              </div>
              <div className="chat-field">
                <label className="chat-label" style={{opacity:0.5}}>Access code <span style={{fontWeight:400}}>(optional)</span></label>
                <input
                  className="chat-input-field"
                  type="password"
                  placeholder="Leave blank if not applicable"
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                />
              </div>
              <button className="chat-start-btn" type="submit" disabled={!name.trim()}>
                Start Chat →
              </button>
            </form>
          )}

          {/* Chat */}
          {phase === 'chat' && (
            <>
              <div className="chat-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                    {m.role === 'ai' && <span className="chat-msg-avatar">🏏</span>}
                    <div className="chat-msg-bubble">{renderMessage(m.content)}</div>
                  </div>
                ))}

                {/* Suggested questions (show after first AI message only) */}
                {messages.length === 1 && (
                  <div className="chat-suggestions">
                    {SUGGESTED.map((s, i) => (
                      <button key={i} className="chat-suggestion" onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                )}

                {loading && (
                  <div className="chat-msg chat-msg-ai">
                    <span className="chat-msg-avatar">🏏</span>
                    <div className="chat-msg-bubble chat-typing">
                      <span/><span/><span/>
                    </div>
                  </div>
                )}

                {error && <div className="chat-error">{error}</div>}
                <div ref={bottomRef} />
              </div>

              <div className="chat-input-row">
                <textarea
                  ref={inputRef}
                  className="chat-textarea"
                  rows={1}
                  placeholder="Ask about a player, team or match…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={loading || questionsLeft === 0}
                  maxLength={300}
                />
                <button
                  className="chat-send"
                  onClick={() => send()}
                  disabled={!input.trim() || loading || questionsLeft === 0}
                >
                  <Send size={16} strokeWidth={2} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
