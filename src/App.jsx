import { useState, useEffect } from 'react';
import SYCLDashboard from './components/SYCLDashboard.jsx';
import FeedbackModal from './components/FeedbackModal.jsx';

export default function App() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const path = window.location.pathname;
  const isRoot = path === '/' || path === '';

  useEffect(() => {
    if (!isRoot) return;
    // Auto-redirect root to most recently updated league
    fetch('/api/leagues')
      .then(r => r.ok ? r.json() : {})
      .then(leagues => {
        const entries = Object.entries(leagues || {});
        if (!entries.length) return;
        entries.sort((a, b) => new Date(b[1].updatedAt || 0) - new Date(a[1].updatedAt || 0));
        window.location.href = '/' + entries[0][0];
      })
      .catch(() => {});
  }, [isRoot]);

  if (isRoot) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</div>
    </div>
  );

  return (
    <>
      <SYCLDashboard onFeedback={() => setFeedbackOpen(true)} />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
