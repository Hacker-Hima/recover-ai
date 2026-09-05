import { eventIcon } from '../api';

export function AgentTimeline({ events, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-12 shimmer rounded" />)}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <div className="text-slate-500 text-sm py-4 text-center">
        No timeline events yet. Run the agent to process this payment.
      </div>
    );
  }

  const sourceColor = (source) => {
    if (source === 'human') return 'text-amber-400';
    if (source === 'baseline') return 'text-purple-400';
    return 'text-brand-500';
  };

  const eventColor = (type) => {
    if (['PAYMENT_RECOVERED'].includes(type)) return 'border-emerald-500/40 bg-emerald-500/5';
    if (['PAYMENT_FAILED', 'ERROR'].includes(type)) return 'border-red-500/40 bg-red-500/5';
    if (['ESCALATED_TO_HUMAN', 'HUMAN_ACTION_TAKEN'].includes(type)) return 'border-amber-500/40 bg-amber-500/5';
    if (['CASE_STOPPED'].includes(type)) return 'border-slate-500/40 bg-slate-500/5';
    if (['GUARDRAIL_APPLIED'].includes(type)) return 'border-orange-500/40 bg-orange-500/5';
    if (['DECISION_MADE'].includes(type)) return 'border-brand-500/40 bg-brand-500/5';
    return 'border-white/5 bg-white/2';
  };

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <div
          key={event._id || i}
          className={`flex gap-3 p-3 rounded-lg border animate-slide-in ${eventColor(event.eventType)}`}
          style={{ animationDelay: `${i * 30}ms` }}
        >
          <div className="flex flex-col items-center gap-1 min-w-[24px]">
            <span className="text-base leading-none">{eventIcon(event.eventType)}</span>
            {i < events.length - 1 && <div className="flex-1 w-px bg-white/10 min-h-[12px]" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 leading-snug">{event.description}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">
                {event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : ''}
              </span>
              <span className={`text-xs font-medium ${sourceColor(event.source)}`}>
                {event.source}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
