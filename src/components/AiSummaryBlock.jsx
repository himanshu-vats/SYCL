import { useState, useEffect } from 'react';

function getLeagueSlug() {
  return window.location.pathname.split('/').filter(Boolean)[0] || '';
}

// Split text into sentences, return [preview (first 3), rest]
function splitSentences(text) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const preview = sentences.slice(0, 3).join('').trim();
  const rest    = sentences.slice(3).join('').trim();
  return [preview, rest];
}

export default function AiSummaryBlock({ type, summaryKey }) {
  const [state,       setState]       = useState('checking');
  const [insight,     setInsight]     = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [expanded,    setExpanded]    = useState(false);
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

  const generate = (bust = false) => {
    setState('loading');
    const url = `/api/ai-summary?league=${encodeURIComponent(league)}&type=${type}&key=${encodeURIComponent(summaryKey)}&generate=true${bust ? '&bust=true' : ''}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setInsight(d.insight); setGeneratedAt(d.generatedAt); setState('done');
      })
      .catch(() => setState('error'));
  };

  if (state === 'checking') return null;

  if (state === 'idle') return (
    <button className="ai-summary-gen-btn" onClick={() => generate(false)}>✦ Generate AI Summary</button>
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

  if (state === 'done') {
    const [preview, rest] = splitSentences(insight);
    const hasMore = rest.length > 0;

    return (
      <div className="ai-summary-block">
        <div className="ai-summary-header">
          <span className="prematch-insight-badge">✦ AI Analysis</span>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {generatedAt && (
              <span className="prematch-insight-footer" style={{margin:0}}>
                {new Date(generatedAt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
              </span>
            )}
            <button className="ai-summary-regen-btn" onClick={() => generate(true)} title="Regenerate">↻</button>
          </div>
        </div>
        <p className="prematch-insight-text">
          {preview}
          {!expanded && hasMore && (
            <button className="ai-summary-more-btn" onClick={() => setExpanded(true)}>
              {' '}Read more →
            </button>
          )}
          {expanded && hasMore && (
            <>{' '}{rest}{' '}
              <button className="ai-summary-more-btn" onClick={() => setExpanded(false)}>
                ← Less
              </button>
            </>
          )}
        </p>
      </div>
    );
  }

  return null;
}
