import { eventIcon } from '../api';

export function AgentTimeline({ events, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-12 shimmer rounded-lg" />)}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="text-slate-400 text-xs py-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        No timeline events recorded yet. Run the agent to trace execution.
      </div>
    );
  }

  const sourceColor = (source) => {
    if (source === 'human') return 'text-amber-700 font-semibold';
    if (source === 'baseline') return 'text-purple-700 font-semibold';
    return 'text-brand-700 font-semibold';
  };

  const eventColor = (type) => {
    if (['PAYMENT_RECOVERED'].includes(type)) return 'border-emerald-200 bg-emerald-50/70';
    if (['PAYMENT_FAILED', 'ERROR'].includes(type)) return 'border-rose-200 bg-rose-50/70';
    if (['ESCALATED_TO_HUMAN', 'HUMAN_ACTION_TAKEN'].includes(type)) return 'border-amber-200 bg-amber-50/70';
    if (['CASE_STOPPED'].includes(type)) return 'border-slate-200 bg-slate-50';
    if (['GUARDRAIL_APPLIED'].includes(type)) return 'border-orange-200 bg-orange-50/70';
    if (['DECISION_MADE'].includes(type)) return 'border-brand-200 bg-brand-50/70';
    return 'border-slate-200 bg-white';
  };

  return (
    <div className="space-y-2.5">
      {events.map((event, i) => (
        <div
          key={event._id || i}
          className={`flex gap-3 p-3 rounded-xl border animate-slide-in shadow-sm ${eventColor(event.eventType)}`}
          style={{ animationDelay: `${i * 25}ms` }}
        >
          <div className="flex flex-col items-center gap-1 min-w-[24px] pt-0.5">
            <span className="text-base leading-none">{eventIcon(event.eventType)}</span>
            {i < events.length - 1 && <div className="flex-1 w-px bg-slate-200 min-h-[14px]" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-800 font-medium leading-snug">{event.description}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-slate-400 font-mono">
                {event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : ''}
              </span>
              <span className="text-slate-300 text-xs">·</span>
              <span className={`text-[11px] ${sourceColor(event.source)}`}>
                {event.source}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
