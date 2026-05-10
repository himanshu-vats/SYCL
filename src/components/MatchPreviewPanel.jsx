import { useState, useEffect } from 'react';
import AiScoutReport from './AiScoutReport.jsx';

export default function MatchPreviewPanel({ matchId, team1, team2, date, division, league, onClose, onDrilldown, fullPage }) {
  const [state,       setState]       = useState('loading');
  const [insight,     setInsight]     = useState('');
  const [generatedAt, setGeneratedAt] = useState('');

  useEffect(() => {
    if (!league || !matchId) { setState('error'); return; }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 42000); // 42s client timeout

    const url = `/api/pre-match?league=${encodeURIComponent(league)}&matchId=${encodeURIComponent(matchId)}`;
    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        clearTimeout(timeout);
        if (d.error) throw new Error(d.error);
        setInsight(d.insight);
        setGeneratedAt(d.generatedAt);
        setState('done');
      })
      .catch(e => {
        clearTimeout(timeout);
        setState(e.name === 'AbortError' ? 'timeout' : 'error');
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [league, matchId]);

  const retry = () => {
    setState('loading');
    const url = `/api/pre-match?league=${encodeURIComponent(league)}&matchId=${encodeURIComponent(matchId)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setInsight(d.insight); setGeneratedAt(d.generatedAt); setState('done'); })
      .catch(() => setState('error'));
  };

  if (fullPage) return (
    <div className="match-page">
      <div className="match-page-header">
        <div>
          <button className="match-page-back" onClick={onClose}>← Back</button>
          <div className="match-page-title">⚡ Match Preview & Prediction</div>
          <div className="match-page-subtitle">{team1} vs {team2}{division ? ` · ${division}` : ''}{date ? ` · ${date}` : ''}</div>
        </div>
      </div>

      <div className="match-page-body">
        <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
          <button className="prematch-team-btn" onClick={() => onDrilldown({type:'team',name:team1})}>{team1} →</button>
          <button className="prematch-team-btn" onClick={() => onDrilldown({type:'team',name:team2})}>{team2} →</button>
        </div>

        {state === 'loading' && (
          <div className="prematch-loading">
            <div className="prematch-spinner"/>
            <span>Generating match preview & prediction… (may take 10–20s)</span>
          </div>
        )}

        {(state === 'error' || state === 'timeout') && (
          <div className="prematch-error">
            {state === 'timeout'
              ? 'Timed out — DeepSeek is slow right now.'
              : 'Could not generate preview.'}
            {' '}<button className="ai-summary-more-btn" onClick={retry}>Try again →</button>
          </div>
        )}

        {state === 'done' && (
          <>
            <div className="prematch-insight">
              <div className="prematch-insight-badge">⚡ AI Prediction</div>
              <p className="prematch-insight-text">{insight}</p>
              {generatedAt && (
                <div className="prematch-insight-footer">
                  Generated {new Date(generatedAt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
                </div>
              )}
            </div>
            <AiScoutReport type="match-strategy" summaryKey={String(matchId)} shareUrl={`${window.location.origin}/${league}#match=${matchId}`} />
          </>
        )}
      </div>
    </div>
  );

  const matchShareUrl = `${window.location.origin}/${league}#match=${matchId}`;

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div>
          <div className="panel-title">⚡ Match Preview & Prediction</div>
          <div className="panel-sub">{team1} vs {team2}{division ? ` · ${division}` : ''}{date ? ` · ${date}` : ''}</div>
        </div>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        <button className="prematch-team-btn" onClick={() => onDrilldown({type:'team',name:team1})}>{team1} →</button>
        <button className="prematch-team-btn" onClick={() => onDrilldown({type:'team',name:team2})}>{team2} →</button>
      </div>

      {state === 'loading' && (
        <div className="prematch-loading">
          <div className="prematch-spinner"/>
          <span>Generating match preview & prediction… (may take 10–20s)</span>
        </div>
      )}

      {(state === 'error' || state === 'timeout') && (
        <div className="prematch-error">
          {state === 'timeout'
            ? 'Timed out — DeepSeek is slow right now.'
            : 'Could not generate preview.'}
          {' '}<button className="ai-summary-more-btn" onClick={retry}>Try again →</button>
        </div>
      )}

      {state === 'done' && (
        <>
          <div className="prematch-insight">
            <div className="prematch-insight-badge">⚡ AI Prediction</div>
            <p className="prematch-insight-text">{insight}</p>
            {generatedAt && (
              <div className="prematch-insight-footer">
                Generated {new Date(generatedAt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
              </div>
            )}
          </div>
          <AiScoutReport type="match-strategy" summaryKey={String(matchId)} shareUrl={matchShareUrl} />
        </>
      )}
    </div>
  );
}
