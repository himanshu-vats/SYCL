export default function AiQuestionTeaser({ questions, onAsk, compact = false }) {
  return (
    <div className={`aqt-wrap${compact ? ' aqt-compact' : ''}`}>
      <div className="aqt-header">
        <span className="aqt-icon">✦</span>
        <span className="aqt-label">Ask the AI</span>
      </div>
      <div className="aqt-chips">
        {questions.map((q, i) => (
          <button key={i} className="aqt-chip" onClick={() => onAsk(q)}>
            {q}
          </button>
        ))}
      </div>
      {!compact && (
        <button className="aqt-open-link" onClick={() => onAsk('')}>
          Or ask your own question →
        </button>
      )}
    </div>
  );
}
