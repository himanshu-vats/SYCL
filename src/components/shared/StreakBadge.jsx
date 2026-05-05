import { computeFormGuide, computeStreak } from '../../utils/form.js';

export default function StreakBadge({ results, team, division }) {
  const form = computeFormGuide(results, team, 5, division);
  const streak = computeStreak(form);
  if (!streak) return null;
  return (
    <span className={`streak-badge streak-${streak.code}`}>
      {streak.code}{streak.count}
    </span>
  );
}
