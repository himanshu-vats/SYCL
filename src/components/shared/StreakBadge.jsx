import { computeFormGuide, computeStreak } from '../../utils/form.js';

export default function StreakBadge({ results, team }) {
  const form = computeFormGuide(results, team);
  const streak = computeStreak(form);
  if (!streak) return null;
  return (
    <span className={`streak-badge streak-${streak.code}`}>
      {streak.code}{streak.count}
    </span>
  );
}
