import { useState, useEffect } from 'react';

function getLeagueSlug() {
  return window.location.pathname.split('/').filter(Boolean)[0] || '';
}

export default function AiSummaryBlock({ type, summaryKey }) {
  const [state,       setState]       = useState('checking');
  const [insight,     setInsight]     = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const league = getLeagueSlug();

  useEffect(() => {
    if (!league || !summaryKey) { setState('idle'); return; }
    fetch(`/api/ai-summary?league=${encodeURIComponent(league)}&type=${type}&key=${encodeURIComponent(summaryKey)}`)
      .then(r => r.json())
      .then(d => {
        if (d.insight) { setInsight(d.insight); setGeneratedAt(d.generatedAt); setState('done'); }
        else setState('idle');
      })
      .catch(() => setState('idle'));
  }, [league, type, summaryKey]);

  const generate = () => {
    setState('loading');
    fetch(`/api/ai-summary?league=${encodeURIComponent(league)}&type=${type}&key=${encodeURIComponent(summaryKey)}&generate=true`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setInsight(d.insight); setGeneratedAt(d.generatedAt); setState('done');
      })
      .catch(() => setState('error'));
  };

  if (state === 'checking') return null;

  if (state === 'idle') return (
    <button className="ai-summary-gen-btn" onClick={generate}>✦ Generate AI Summary</button>
  );

  if (state === 'loading') return (
    <div className="prematch-loading" style={{padding:'12px 0'}}>
      <div className="prematch-spinner"/>
      <span>Generating AI summary…</span>
    </div>
  );

  if (state === 'error') return (
    <div className="prematch-error">Could not generate summary.</div>
  );

  if (state === 'done') return (
    <div className="ai-summary-block">
      <div className="prematch-insight-badge">✦ AI Summary</div>
      <p className="prematch-insight-text">{insight}</p>
      {generatedAt && (
        <div className="prematch-insight-footer">
          Generated {new Date(generatedAt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
        </div>
      )}
    </div>
  );

  return null;
}
