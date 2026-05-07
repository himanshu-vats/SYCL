import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Plus } from 'lucide-react';
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

function storageKey(slug) {
  return `sycl_chat_v1_${slug}`;
}

function loadSession(slug) {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(slug, data) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(data));
  } catch {}
}

export default function AiChat({ slug }) {
  const [saved] = useState(() => loadSession(slug));

  const [phase,        setPhase]        = useState(() => saved ? 'chat' : 'intro');
  const [name,         setName]         = useState(() => saved?.name || '');
  const [role,         setRole]         = useState(() => saved?.role || 'parent');
  const [accessCode,   setAccessCode]   = useState(() => saved?.accessCode || '');
  const [sessionId,    setSessionId]    = useState(() => saved?.sessionId || Math.random().toString(36).slice(2));
  const [messages,     setMessages]     = useState(() => saved?.messages || []);
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

  // Persist conversation to localStorage whenever messages change
  useEffect(() => {
    if (phase !== 'chat' || !name) return;
    saveSession(slug, { name, role, accessCode, sessionId, messages });
  }, [messages, slug, name, role, accessCode, sessionId, phase]);

  const startChat = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const welcome = {
      role: 'ai',
      content: `Hi ${name.trim()}! 🏏 I'm your SYCL Season Insight assistant. Ask me anything about the season — player stats, standings, upcoming matches, or how to improve your game!`,
    };
    setMessages([welcome]);
    setPhase('chat');
  };

  const newChat = () => {
    const newId = Math.random().toString(36).slice(2);
    setSessionId(newId);
    const welcome = {
      role: 'ai',
      content: `Hi ${name}! Starting a fresh conversation. What would you like to know? 🏏`,
    };
    setMessages([welcome]);
    setError('');
    setQuestionsLeft(20);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading || questionsLeft === 0) return;
    setInput('');
    setError('');
    const userMsg = { role: 'user', content: q };
    // Capture history before state update (slice sends previous exchanges as context)
    const historySnap = messages.slice(-10);
    setMessages(prev => [...prev, userMsg]);
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
          history:     historySnap,
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
    <div className="chat-page">
      {/* Header */}
      <div className="chat-page-header">
        <div className="chat-page-header-left">
          <Bot size={17} strokeWidth={1.8} className="chat-page-bot-icon" />
          <span className="chat-page-title">SYCL AI Assistant</span>
          {phase === 'chat' && name && (
            <span className="chat-page-user">· {name}</span>
          )}
          {phase === 'chat' && (
            <span className="chat-page-quota">
              {questionsLeft === 999 ? 'Unlimited' : `${questionsLeft} left today`}
            </span>
          )}
        </div>
        {phase === 'chat' && (
          <button className="chat-new-btn" onClick={newChat} title="Start a new conversation">
            <Plus size={14} strokeWidth={2.5} />
            New chat
          </button>
        )}
      </div>

      {/* Intro form */}
      {phase === 'intro' && (
        <div className="chat-page-intro-wrap">
          <form className="chat-intro chat-intro-page" onSubmit={startChat}>
            <div className="chat-intro-icon">🏏</div>
            <p className="chat-intro-text">
              Ask about player stats, standings, upcoming matches, or cricket improvement tips!
            </p>
            <div className="chat-field">
              <label className="chat-label">Your name</label>
              <input
                className="chat-input-field"
                placeholder="e.g. your name or your child's name"
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
        </div>
      )}

      {/* Chat messages */}
      {phase === 'chat' && (
        <>
          <div className="chat-page-messages">
            <div className="chat-page-messages-inner">
              {messages.map((m, i) => (
                <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                  {m.role === 'ai' && <span className="chat-msg-avatar">🏏</span>}
                  <div className="chat-msg-bubble">{renderMessage(m.content)}</div>
                </div>
              ))}

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
          </div>

          <div className="chat-page-input-area">
            <div className="chat-page-input-row">
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
          </div>
        </>
      )}
    </div>
  );
}
