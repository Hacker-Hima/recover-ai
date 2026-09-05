import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '../api';

const COLORS = ['#4f6ef7', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-2 border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      {label && <div className="text-slate-400 mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}: </span>
          <span className="text-white font-medium">{typeof p.value === 'number' && p.value > 1000 ? formatCurrency(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function FailureCategoryChart({ metrics }) {
  const data = metrics?.byCategory
    ? Object.entries(metrics.byCategory).map(([name, v]) => ({
        name: name.replace(/_/g, ' '),
        value: v.total,
        recovered: v.recovered,
        rate: (v.rate * 100).toFixed(0) + '%',
      }))
    : [];

  if (!data.length) return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Failure Distribution</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ActionDistributionChart({ metrics }) {
  const data = metrics?.actionDist
    ? Object.entries(metrics.actionDist).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        value,
      })).sort((a, b) => b.value - a.value)
    : [];

  if (!data.length) return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Action Distribution</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={130} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill="#4f6ef7" radius={[0, 4, 4, 0]} name="Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecoveryCompareChart({ data }) {
  if (!data?.recoverai && !data?.baseline) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Run both agents to see comparison</div>;
  }

  const chartData = [
    {
      name: 'Recovery Rate',
      RecoverAI: data.recoverai?.recoveryRate || 0,
      Baseline: data.baseline?.recoveryRate || 0,
      unit: '%',
    },
    {
      name: 'Avg Retries',
      RecoverAI: data.recoverai?.avgRetries || 0,
      Baseline: data.baseline?.avgRetries || 0,
      unit: '',
    },
    {
      name: 'Escalations',
      RecoverAI: data.recoverai?.humanEscalationRate || 0,
      Baseline: data.baseline?.humanEscalationRate || 0,
      unit: '%',
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3">RecoverAI vs Baseline</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{v}</span>} />
          <Bar dataKey="RecoverAI" fill="#4f6ef7" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Baseline" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
