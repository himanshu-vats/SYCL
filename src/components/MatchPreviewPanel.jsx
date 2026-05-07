import { useState, useEffect } from 'react';

export default function MatchPreviewPanel({ matchId, team1, team2, date, division, league, onClose, onDrilldown }) {
  const [state, setState] = useState('loading'); // loading | done | error
  const [insight, setInsight] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');

  useEffect(() => {
    if (!league || !matchId) { setState('error'); return; }
    const url = `/api/pre-match?league=${encodeURIComponent(league)}&matchId=${encodeURIComponent(matchId)}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setInsight(d.insight);
        setGeneratedAt(d.generatedAt);
        setState('done');
      })
      .catch(() => setState('error'));
  }, [league, matchId]);

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div>
          <div className="panel-title">⚡ Pre-Match Preview</div>
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
          <span>Generating AI preview…</span>
        </div>
      )}

      {state === 'error' && (
        <div className="prematch-error">
          Could not generate preview. Make sure the league is synced and the API key is configured.
        </div>
      )}

      {state === 'done' && (
        <div className="prematch-insight">
          <div className="prematch-insight-badge">AI Preview</div>
          <p className="prematch-insight-text">{insight}</p>
          {generatedAt && (
            <div className="prematch-insight-footer">
              Generated {new Date(generatedAt).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
