import type { OwnershipHistory } from '@/api/types';

const EVENT_TYPE_COLORS: Record<string, string> = {
  purchased: 'bg-green-100 text-green-800',
  sold: 'bg-red-100 text-red-800',
  traded: 'bg-blue-100 text-blue-800',
  gifted: 'bg-purple-100 text-purple-800',
  transferred: 'bg-yellow-100 text-yellow-800',
};

function formatEventType(eventType: string): string {
  return eventType.charAt(0).toUpperCase() + eventType.slice(1);
}

interface OwnershipEventProps {
  event: OwnershipHistory;
}

export function OwnershipEvent({ event }: OwnershipEventProps) {
  const badgeColor = EVENT_TYPE_COLORS[event.event_type] ?? 'bg-slate-100 text-slate-800';

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4"
      data-testid="ownership-event"
    >
      <div className="flex items-start gap-3">
        {/* Timeline dot */}
        <div className="flex-shrink-0 mt-1">
          <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-200" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}
              data-testid="event-type-badge"
            >
              {formatEventType(event.event_type)}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(event.date).toLocaleDateString()}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {event.price != null && (
              <span data-testid="event-price">
                {event.currency ?? '$'}{event.price.toLocaleString()}
              </span>
            )}
            {event.mileage_km != null && (
              <span>{event.mileage_km.toLocaleString()} km</span>
            )}
            {event.counterparty && (
              <span>{event.counterparty}</span>
            )}
          </div>
          {event.notes && (
            <p className="text-xs text-gray-400 mt-1">{event.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
