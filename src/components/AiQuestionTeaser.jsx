export default function AiQuestionTeaser({ questions, onAsk, compact = false }) {
  return (
    <div className={`aqt-wrap${compact ? ' aqt-compact' : ''}`}>
      <span className="aqt-icon">✦</span>
      <div className="aqt-chips">
        {questions.map((q, i) => (
          <button key={i} className="aqt-chip" onClick={() => onAsk(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
