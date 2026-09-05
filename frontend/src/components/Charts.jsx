import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '../api';

const COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs shadow-lg text-slate-800">
      {label && <div className="text-slate-500 font-medium mb-1.5">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}: </span>
          <span className="text-slate-900 font-bold">{typeof p.value === 'number' && p.value > 1000 ? formatCurrency(p.value) : p.value}</span>
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

  if (!data.length) {
    return (
      <div className="h-full flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Failure Distribution</h3>
        <div className="h-44 flex items-center justify-center text-slate-400 text-xs">No failure data yet</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Failure Distribution</h3>
        <span className="text-xs text-slate-400 font-medium">By Category</span>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68} innerRadius={38} paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ color: '#475569', fontSize: '11px', fontWeight: 500 }}>{v}</span>}
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

  if (!data.length) {
    return (
      <div className="h-full flex flex-col justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Action Distribution</h3>
        <div className="h-44 flex items-center justify-center text-slate-400 text-xs">No actions executed yet</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">Action Distribution</h3>
        <span className="text-xs text-slate-400 font-medium">Policy Guardrails</span>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} width={120} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecoveryCompareChart({ data }) {
  if (!data?.recoverai && !data?.baseline) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
        Run both Recovery Agent and Baseline to view visual comparison
      </div>
    );
  }

  const chartData = [
    {
      name: 'Recovery Rate (%)',
      RecoverAI: data.recoverai?.recoveryRate || 0,
      Baseline: data.baseline?.recoveryRate || 0,
    },
    {
      name: 'Avg Retries',
      RecoverAI: data.recoverai?.avgRetries || 0,
      Baseline: data.baseline?.avgRetries || 0,
    },
    {
      name: 'Escalations (%)',
      RecoverAI: data.recoverai?.humanEscalationRate || 0,
      Baseline: data.baseline?.humanEscalationRate || 0,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <h3 className="text-base font-semibold text-slate-900">Performance Comparison</h3>
        <span className="text-xs text-slate-500 font-medium">RecoverAI Agent vs. Naive Retry Baseline</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={(v) => <span style={{ color: '#334155', fontSize: '12px', fontWeight: 600 }}>{v}</span>} />
          <Bar dataKey="RecoverAI" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Baseline" fill="#a855f7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
