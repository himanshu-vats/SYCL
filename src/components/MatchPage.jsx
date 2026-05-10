import { useState, useEffect, useMemo } from 'react';
import AiScoutReport from './AiScoutReport.jsx';
import { shareToWhatsApp, stripMarkdown, truncateText } from '../utils/share.js';

function getLeagueSlug() {
  return window.location.pathname.split('/').filter(Boolean)[0] || '';
}

export default function MatchPage({ matchId, data, league, onClose, onDrilldown }) {
  const [preState, setPreState] = useState('loading');
  const [preInsight, setPreInsight] = useState('');
  const [preGeneratedAt, setPreGeneratedAt] = useState('');

  const match = useMemo(() =>
    data?.matches?.find(m => String(m.id) === String(matchId)),
    [data, matchId]
  );

  const isPostMatch = Boolean(match?.team1Score || match?.team2Score || match?.result);

  // Filter innings for this match
  const matchInnings = useMemo(() =>
    (data?.playerInnings || []).filter(i => String(i.matchId) === String(matchId)),
    [data, matchId]
  );

  const team1Bat = useMemo(() =>
    matchInnings.filter(i => i.role === 'bat' && i.team === match?.team1),
    [matchInnings, match]
  );
  const team2Bat = useMemo(() =>
    matchInnings.filter(i => i.role === 'bat' && i.team === match?.team2),
    [matchInnings, match]
  );
  const team1Bowl = useMemo(() =>
    matchInnings.filter(i => i.role === 'bowl' && i.team === match?.team1),
    [matchInnings, match]
  );
  const team2Bowl = useMemo(() =>
    matchInnings.filter(i => i.role === 'bowl' && i.team === match?.team2),
    [matchInnings, match]
  );

  // Fetch pre-match prediction
  useEffect(() => {
    if (isPostMatch || !league || !matchId) { setPreState('done'); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 42000);

    fetch(`/api/pre-match?league=${encodeURIComponent(league)}&matchId=${encodeURIComponent(matchId)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => {
        clearTimeout(timer);
        if (d.insight) {
          setPreInsight(d.insight);
          setPreGeneratedAt(d.generatedAt);
          setPreState('done');
        } else {
          setPreState('done');
        }
      })
      .catch(() => {
        clearTimeout(timer);
        setPreState(ctrl.signal.aborted ? 'timeout' : 'error');
      });

    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [isPostMatch, league, matchId]);

  const retryPreMatch = () => {
    setPreState('loading');
    fetch(`/api/pre-match?league=${encodeURIComponent(league)}&matchId=${encodeURIComponent(matchId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.insight) { setPreInsight(d.insight); setPreGeneratedAt(d.generatedAt); setPreState('done'); }
        else setPreState('done');
      })
      .catch(() => setPreState('error'));
  };

  // Share
  const shareUrl = match ? `${window.location.origin}/${league}#match=${matchId}` : '';
  const shareText = match
    ? `${match.team1} vs ${match.team2}${match.division ? ' · ' + match.division : ''}${match.date ? ' · ' + match.date : ''}`
    : '';

  const handleShare = () => {
    const text = preInsight
      ? truncateText(stripMarkdown(preInsight), 300) + '\n\n' + shareText
      : shareText;
    shareToWhatsApp(text, shareUrl);
  };

  // ── Not found ──
  if (data && !match) return (
    <div className="match-page">
      <div className="match-page-header">
        <button className="match-page-back" onClick={onClose}>← Back</button>
        <div className="match-page-title">Match Not Found</div>
        <div className="match-page-subtitle">The match you're looking for doesn't exist or hasn't been synced yet.</div>
      </div>
    </div>
  );

  // ── Loading ──
  if (!data) return (
    <div className="match-page">
      <div className="match-page-body">
        <div className="scout-report-loading"><div className="prematch-spinner" /><span>Loading…</span></div>
      </div>
    </div>
  );

  const { team1, team2, division, date, result, team1Score, team2Score } = match;

  const renderInningsTable = (rows, type) => {
    if (!rows.length) return (
      <div className="mp-empty-innings">No {type} data available</div>
    );

    if (type === 'bat') {
      return (
        <table className="mp-innings-table">
          <thead>
            <tr>
              <th>Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
              <th>Dismissal</th>
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => (b.runs || 0) - (a.runs || 0)).map((r, i) => (
              <tr key={i}>
                <td className="clickable" onClick={() => onDrilldown({ type: 'player', name: r.player })}>{r.player}{r.notOut ? '*' : ''}</td>
                <td>{r.runs || 0}</td>
                <td>{r.balls || 0}</td>
                <td>{r.fours || 0}</td>
                <td>{r.sixes || 0}</td>
                <td>{(r.sr || 0).toFixed(1)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.dismissal || 'not out'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="mp-innings-table">
        <thead>
          <tr>
            <th>Bowler</th>
            <th>O</th>
            <th>M</th>
            <th>R</th>
            <th>W</th>
            <th>Econ</th>
          </tr>
        </thead>
        <tbody>
          {rows.sort((a, b) => (b.wickets || 0) - (a.wickets || 0)).map((r, i) => (
            <tr key={i}>
              <td className="clickable" onClick={() => onDrilldown({ type: 'player', name: r.player })}>{r.player}</td>
              <td>{r.overs || '—'}</td>
              <td>{r.maidens || 0}</td>
              <td>{r.runs || 0}</td>
              <td style={{ fontWeight: 700, color: (r.wickets || 0) >= 3 ? 'var(--accent)' : '' }}>{r.wickets || 0}</td>
              <td>{(r.econ || 0).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="match-page">
      {/* Header */}
      <div className="match-page-header">
        <button className="match-page-back" onClick={onClose}>← Back</button>
        <div className="match-page-title">{team1} vs {team2}</div>
        <div className="match-page-subtitle">
          {division}{date ? ` · ${date}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="prematch-team-btn" onClick={() => onDrilldown({ type: 'team', name: team1 })}>{team1} →</button>
          <button className="prematch-team-btn" onClick={() => onDrilldown({ type: 'team', name: team2 })}>{team2} →</button>
          {isPostMatch && (
            <button className="scout-report-share-btn" onClick={handleShare} title="Share on WhatsApp">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              Share
            </button>
          )}
        </div>
      </div>

      <div className="match-page-body">
        {/* ── Post-match: Scorecard ── */}
        {isPostMatch && (
          <>
            <div className="mp-score-bar">
              {team1Score ? (
                <div className="mp-score-team">
                  <div className="mp-score-team-name">{team1}</div>
                  <div className="mp-score-team-score">{team1Score.score}</div>
                  <div className="mp-score-team-overs">{team1Score.overs || '?'} overs</div>
                </div>
              ) : (
                <div className="mp-score-team">
                  <div className="mp-score-team-name">{team1}</div>
                  <div className="mp-score-team-score" style={{ color: 'var(--text-muted)', fontSize: 16 }}>—</div>
                </div>
              )}
              <div className="mp-score-vs">vs</div>
              {team2Score ? (
                <div className="mp-score-team">
                  <div className="mp-score-team-name">{team2}</div>
                  <div className="mp-score-team-score">{team2Score.score}</div>
                  <div className="mp-score-team-overs">{team2Score.overs || '?'} overs</div>
                </div>
              ) : (
                <div className="mp-score-team">
                  <div className="mp-score-team-name">{team2}</div>
                  <div className="mp-score-team-score" style={{ color: 'var(--text-muted)', fontSize: 16 }}>—</div>
                </div>
              )}
            </div>
            {result && <div className="mp-score-result">{result}</div>}

            {/* Innings tables */}
            {(team1Bat.length > 0 || team2Bat.length > 0) && (
              <div className="mp-innings-section">
                {team1Bat.length > 0 && (
                  <>
                    <div className="mp-innings-title">{team1} — Batting</div>
                    {renderInningsTable(team1Bat, 'bat')}
                  </>
                )}
                {team2Bat.length > 0 && (
                  <>
                    <div className="mp-innings-title">{team2} — Batting</div>
                    {renderInningsTable(team2Bat, 'bat')}
                  </>
                )}
              </div>
            )}

            {(team1Bowl.length > 0 || team2Bowl.length > 0) && (
              <div className="mp-innings-section">
                {team1Bowl.length > 0 && (
                  <>
                    <div className="mp-innings-title">{team1} — Bowling</div>
                    {renderInningsTable(team1Bowl, 'bowl')}
                  </>
                )}
                {team2Bowl.length > 0 && (
                  <>
                    <div className="mp-innings-title">{team2} — Bowling</div>
                    {renderInningsTable(team2Bowl, 'bowl')}
                  </>
                )}
              </div>
            )}

            {matchInnings.length === 0 && (
              <div className="mp-empty-innings" style={{ marginBottom: 20 }}>
                Detailed innings data not yet synced for this match.
              </div>
            )}

            <AiScoutReport type="match-report" summaryKey={String(matchId)} shareUrl={shareUrl} />
          </>
        )}

        {/* ── Pre-match: Prediction ── */}
        {!isPostMatch && (
          <>
            {preState === 'loading' && (
              <div className="scout-report-loading">
                <div className="prematch-spinner" />
                <span>Generating match preview &amp; prediction… (may take 10–20s)</span>
              </div>
            )}

            {(preState === 'error' || preState === 'timeout') && (
              <div className="scout-report-error">
                {preState === 'timeout' ? 'Timed out — DeepSeek is slow right now.' : 'Could not generate preview.'}
                {' '}<button onClick={retryPreMatch}>Try again →</button>
              </div>
            )}

            {preState === 'done' && preInsight && (
              <div className="prematch-insight">
                <div className="prematch-insight-badge">⚡ AI Prediction</div>
                <p className="prematch-insight-text">{preInsight}</p>
                {preGeneratedAt && (
                  <div className="prematch-insight-footer">
                    Generated {new Date(preGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <button className="scout-report-share-btn" onClick={handleShare}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    Share
                  </button>
                </div>
              </div>
            )}

            <AiScoutReport type="match-strategy" summaryKey={String(matchId)} shareUrl={shareUrl} />
          </>
        )}
      </div>
    </div>
  );
}
