import { computeFormGuide } from '../../utils/form.js';

export default function FormGuide({ results, team }) {
  const form = computeFormGuide(results, team);
  if (!form.length) return <span style={{color:'var(--text-muted)',fontSize:11}}>—</span>;
  return (
    <div className="form-guide">
      {form.map((code, i) => <span key={i} className={`fd fd-${code}`}>{code}</span>)}
    </div>
  );
}
