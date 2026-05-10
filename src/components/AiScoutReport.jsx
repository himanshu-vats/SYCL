import { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';
import { shareToWhatsApp, stripMarkdown, truncateText } from '../utils/share.js';

function getLeagueSlug() {
  return window.location.pathname.split('/').filter(Boolean)[0] || '';
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Parse markdown content into collapsible sections based on ## headers.
 * Returns [{ title, bodyHtml }] — sections between ## headers.
 */
function parseSections(markdown) {
  const sections = [];
  const lines = markdown.split('\n');
  let currentTitle = '';
  let currentBody = [];

  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (currentTitle || currentBody.length) {
        sections.push({
          title: currentTitle || 'Overview',
          bodyHtml: marked.parse(currentBody.join('\n').trim(), { breaks: true, gfm: true }),
        });
      }
      currentTitle = line.replace(/^##\s*/, '').trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentTitle || currentBody.length) {
    sections.push({
      title: currentTitle || 'Overview',
      bodyHtml: marked.parse(currentBody.join('\n').trim(), { breaks: true, gfm: true }),
    });
  }
  return sections;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 1) return 'just now';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export default function AiScoutReport({ type, summaryKey, shareUrl }) {
  const [state, setState] = useState('checking');
  const [insight, setInsight] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const league = getLeagueSlug();

  // Check for cached summary on mount
  useEffect(() => {
    if (!league || !summaryKey) { setState('idle'); return; }
    fetch(`/api/ai-summary?league=${encodeURIComponent(league)}&type=${type}&key=${encodeURIComponent(summaryKey)}`)
      .then(r => r.json())
      .then(d => {
        if (d.insight) {
          setInsight(d.insight);
          setGeneratedAt(d.generatedAt);
          setState('done');
        } else {
          setState('idle');
        }
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
        setInsight(d.insight);
        setGeneratedAt(d.generatedAt);
        setState('done');
      })
      .catch(() => setState('error'));
  };

  // Parse sections from markdown
  const sections = useMemo(() => {
    if (!insight) return [];
    const parsed = parseSections(insight);
    // Auto-expand first section
    if (parsed.length && Object.keys(expandedSections).length === 0) {
      setExpandedSections({ [parsed[0].title]: true });
    }
    return parsed;
  }, [insight]);

  const toggleSection = (title) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const isStale = generatedAt && (Date.now() - new Date(generatedAt).getTime()) > 24 * HOUR_MS;

  // ── Render states ──

  if (state === 'checking') return null;

  if (state === 'idle') {
    const labels = {
      'team-scout': 'Generate Scouting Report',
      'player-deep': 'Generate Player Analysis',
      'match-strategy': 'Generate Match Strategy',
      'season-insights': 'Generate Season Insights',
    };
    return (
      <button className="scout-report-gen-btn" onClick={() => generate(false)}>
        {labels[type] || 'Generate AI Report'}
      </button>
    );
  }

  if (state === 'loading') return (
    <div className="scout-report-loading">
      <div className="prematch-spinner" />
      <span>Analyzing data…</span>
    </div>
  );

  if (state === 'error') return (
    <div className="scout-report-error">
      Could not generate report. <button onClick={() => generate(false)}>Retry</button>
    </div>
  );

  if (state === 'done') {
    const titleLabels = {
      'team-scout': 'Scouting Report',
      'player-deep': 'Player Analysis',
      'match-strategy': 'Match Strategy',
      'season-insights': 'Season Insights',
    };

    return (
      <div className="scout-report">
        <div className="scout-report-header">
          <div className="scout-report-title-row">
            <span className="scout-report-badge">{titleLabels[type] || 'AI Report'}</span>
            <div className="scout-report-meta">
              {generatedAt && (
                <span className={`scout-report-timestamp${isStale ? ' scout-stale' : ''}`}>
                  {timeAgo(generatedAt)}{isStale ? ' · Regenerate?' : ''}
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
              <button className="scout-report-regen-btn" onClick={() => generate(true)} title="Regenerate">↻</button>
            </div>
          </div>
        </div>

        {sections.length > 0 ? (
          <div className="scout-report-sections">
            {sections.map((section) => (
              <div key={section.title} className={`scout-section${expandedSections[section.title] ? ' open' : ''}`}>
                <button
                  className="scout-section-toggle"
                  onClick={() => toggleSection(section.title)}
                >
                  <span className="scout-section-arrow">▸</span>
                  <span className="scout-section-title">{section.title}</span>
                </button>
                {expandedSections[section.title] && (
                  <div
                    className="scout-section-content"
                    dangerouslySetInnerHTML={{ __html: section.bodyHtml }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="scout-report-plain" dangerouslySetInnerHTML={{ __html: marked.parse(insight, { breaks: true, gfm: true }) }} />
        )}
      </div>
    );
  }

  return null;
}
