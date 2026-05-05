import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, Cell,
  LineChart, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { computeRollingAverage } from '../utils/innings.js';

const COLORS = {
  wins: '#22c55e',
  losses: '#f97316',
  batting: '#3b82f6',
  bowling: '#a855f7',
};

function scoreColor(score) {
  if (score >= 86) return '#f59e0b';
  if (score >= 71) return '#22c55e';
  if (score >= 51) return '#3b82f6';
  return '#f97316';
}

export function ImpactRatingCard({ score, label, trend }) {
  if (score == null) return null;
  const color = scoreColor(score);

  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';
  const trendClass = `impact-trend-${trend || 'stable'}`;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 220, height: 165, margin: '0 auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="70%"
            innerRadius="48%" outerRadius="68%"
            barSize={10}
            data={[{ name: 'Impact', value: score }]}
            startAngle={180} endAngle={0}
          >
            <RadialBar dataKey="value" fill={color} background={{ fill: '#e5e7eb' }} />
            <Tooltip formatter={(value) => [`Impact Score: ${value} / 100`, '']} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>
          <div className="impact-score" style={{ color }}>{score}</div>
          <div className="impact-subtitle">/100 — composite season score</div>
          <div className="impact-label">{label}</div>
          <div className="impact-desc">Based on runs, wickets, economy &amp; match impact</div>
          <div className={trendClass} style={{ fontSize: 14, marginTop: 2 }}>
            {trendIcon}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunsWicketsChart({ data }) {
  if (!data || data.length === 0) return null;

  const hasBowling = data.some(d => d.wickets > 0);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
        {hasBowling && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />}
        <Tooltip
          formatter={(value, name) => [value, name === 'runs' ? 'Runs' : 'Wickets']}
          labelFormatter={(label, payload) => {
            if (payload && payload[0]) {
              const d = payload[0].payload;
              const result = d.win === true ? 'Won' : d.win === false ? 'Lost' : '—';
              return `${label} (${result})`;
            }
            return label;
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="runs" name="Runs" barSize={16} radius={[3, 3, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.win === true ? COLORS.wins : entry.win === false ? COLORS.losses : COLORS.batting} />
          ))}
        </Bar>
        {hasBowling && (
          <Line yAxisId="right" dataKey="wickets" name="Wickets" stroke={COLORS.bowling} strokeWidth={2} dot={{ r: 3 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function FormTrendChart({ battingHistory, bowlingHistory }) {
  const batRolling = battingHistory && battingHistory.length >= 4
    ? computeRollingAverage(battingHistory, 'runs', 3)
    : [];

  const bowlRolling = bowlingHistory && bowlingHistory.length >= 4
    ? computeRollingAverage(bowlingHistory, 'wickets', 3)
    : [];

  if (batRolling.length === 0 && bowlRolling.length === 0) return null;

  const chartData = [];
  const maxLen = Math.max(batRolling.length, bowlRolling.length);
  for (let i = 0; i < maxLen; i++) {
    chartData.push({
      match: i + 1,
      runs: batRolling[i] ? batRolling[i].value : null,
      wickets: bowlRolling[i] ? bowlRolling[i].value : null,
      label: batRolling[i]?.label || bowlRolling[i]?.label || `M${i + 1}`,
    });
  }

  const batAll = battingHistory || [];
  const careerAvg = batAll.length > 0
    ? batAll.reduce((s, i) => s + (parseInt(i.runs) || 0), 0) / batAll.length
    : 0;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis dataKey="match" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        {batRolling.length > 0 && (
          <Line type="monotone" dataKey="runs" stroke={COLORS.batting} strokeWidth={2} dot={{ r: 3 }} name="Runs (3-match avg)" connectNulls />
        )}
        {bowlRolling.length > 0 && (
          <Line type="monotone" dataKey="wickets" stroke={COLORS.bowling} strokeWidth={2} dot={{ r: 3 }} name="Wickets (3-match avg)" connectNulls />
        )}
        {careerAvg > 0 && (
          <ReferenceLine y={careerAvg} stroke="#888" strokeDasharray="5 5" label={{ value: `Career: ${careerAvg.toFixed(0)}`, fontSize: 10, fill: '#888' }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PlayerRadarChart({ radar }) {
  if (!radar) return null;

  const data = [
    { dimension: 'Attack', value: radar.attack },
    { dimension: 'Defense', value: radar.defense },
    { dimension: 'Consistency', value: radar.consistency },
    { dimension: 'Impact', value: radar.impact },
    { dimension: 'Allround', value: radar.allround },
  ];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <PolarGrid />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
        <Radar dataKey="value" stroke={COLORS.batting} fill={COLORS.batting} fillOpacity={0.25} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
