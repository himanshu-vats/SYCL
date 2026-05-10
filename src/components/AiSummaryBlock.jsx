import { useState, useEffect } from 'react';
import { shareToWhatsApp, stripMarkdown, truncateText } from '../utils/share.js';

function getLeagueSlug() {
  return window.location.pathname.split('/').filter(Boolean)[0] || '';
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

function splitContent(text, isMobile) {
  if (isMobile) {
    const words = text.split(/\s+/);
    const preview = words.slice(0, 15).join(' ') + (words.length > 15 ? '…' : '');
    const rest = words.length > 15 ? words.slice(15).join(' ') : '';
    return [preview, rest];
  }
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  return [sentences.slice(0, 5).join('').trim(), sentences.slice(5).join('').trim()];
}

export default function AiSummaryBlock({ type, summaryKey, shareUrl }) {
  const [state,       setState]       = useState('checking');
  const [insight,     setInsight]     = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [expanded,    setExpanded]    = useState(false);
  const isMobile = useIsMobile();
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
    const [preview, rest] = splitContent(insight, isMobile);
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
            {shareUrl && (
              <button className="scout-report-share-btn" onClick={() => {
                const plain = stripMarkdown(insight);
                const preview = truncateText(plain, 300);
                shareToWhatsApp(preview, shareUrl);
              }} title="Share on WhatsApp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                Share
              </button>
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
