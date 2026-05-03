import { parseDate } from './schedule.js';

export function computeFormGuide(results, team, n = 5) {
  if (!results?.matches?.length) return [];
  return results.matches
    .filter(m => m.team1 === team || m.team2 === team)
    .sort((a, b) => { const da = parseDate(a.date), db = parseDate(b.date); return da && db ? da - db : 0; })
    .slice(-n)
    .map(m => {
      const r = (m.result || '').toLowerCase();
      if (r.includes('abandon') || r.includes('no result')) return 'A';
      if (r.includes('forfeit')) {
        const teamLower = team.toLowerCase();
        return r.includes(teamLower) && !r.includes('forfeit by ' + teamLower.split(' ')[0]) ? 'W' : 'L';
      }
      const score = m.team1 === team ? m.team1Score : m.team2Score;
      if (score?.won === true) return 'W';
      if (score?.won === false) return 'L';
      return 'NR';
    });
}

export function computeStreak(form) {
  if (!form.length) return null;
  const last = form[form.length - 1];
  if (last !== 'W' && last !== 'L') return null;
  let count = 0;
  for (let i = form.length - 1; i >= 0; i--) { if (form[i] === last) count++; else break; }
  return { code: last, count };
}

export function sortRows(rows, col, dir) {
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const va = a[col], vb = b[col];
    const na = parseFloat(va), nb = parseFloat(vb);
    const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : String(va||'').localeCompare(String(vb||''));
    return dir === 'asc' ? cmp : -cmp;
  });
}
