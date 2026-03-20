import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEvents, useCreateEvent } from '@/hooks/useEvents';
import { useBikes } from '@/hooks/useBikes';
import { useTracks } from '@/hooks/useTracks';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Modal } from '@/components/common/Modal';
import type { CreateEventRequest, Conditions } from '@/api/types';

const CONDITION_OPTIONS = ['dry', 'damp', 'wet', 'mixed'] as const;

interface EventForm {
  bike_id: string;
  track_id: string;
  date: string;
  conditions: Conditions;
}

const INITIAL_FORM: EventForm = {
  bike_id: '',
  track_id: '',
  date: '',
  conditions: {
    temp_c: null,
    humidity_pct: null,
    track_temp_c: null,
    wind_kph: null,
    condition: null,
    notes: null,
  },
};

export default function Events() {
  const [filterBike, setFilterBike] = useState<string>('');
  const [filterTrack, setFilterTrack] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (filterBike) f.bike_id = filterBike;
    if (filterTrack) f.track_id = filterTrack;
    if (filterFromDate) f.from_date = filterFromDate;
    if (filterToDate) f.to_date = filterToDate;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filterBike, filterTrack, filterFromDate, filterToDate]);

  const { data: events, isLoading, isError, refetch } = useEvents(filters);
  const { data: bikes } = useBikes();
  const { data: tracks } = useTracks();
  const createEvent = useCreateEvent();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<EventForm>({ ...INITIAL_FORM });

  const bikeLookup = useMemo(() => {
    const map = new Map<string, string>();
    bikes?.forEach((b) => map.set(b.id, `${b.make} ${b.model}`));
    return map;
  }, [bikes]);

  const trackLookup = useMemo(() => {
    const map = new Map<string, string>();
    tracks?.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tracks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bike_id || !form.track_id || !form.date) return;
    const payload: CreateEventRequest = {
      bike_id: form.bike_id,
      track_id: form.track_id,
      date: form.date,
      conditions: form.conditions,
    };
    createEvent.mutate(payload, {
      onSuccess: () => {
        setShowAdd(false);
        setForm({ ...INITIAL_FORM });
      },
    });
  };

  const updateCondition = <K extends keyof Conditions>(key: K, value: Conditions[K]) => {
    setForm((f) => ({
      ...f,
      conditions: { ...f.conditions, [key]: value },
    }));
  };

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Events</h2>
        </div>
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Events</h2>
        </div>
        <ErrorState message="Failed to load events. Please try again." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Events</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 min-h-[44px] bg-accent-orange text-white text-sm font-medium rounded-lg hover:bg-accent-orange-hover transition-colors"
          data-testid="add-event-button"
        >
          Add Event
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="event-filters">
        <select
          value={filterBike}
          onChange={(e) => setFilterBike(e.target.value)}
          className="px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange"
          data-testid="filter-bike"
          aria-label="Filter by bike"
        >
          <option value="">All Bikes</option>
          {bikes?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.make} {b.model}
            </option>
          ))}
        </select>

        <select
          value={filterTrack}
          onChange={(e) => setFilterTrack(e.target.value)}
          className="px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange"
          data-testid="filter-track"
          aria-label="Filter by track"
        >
          <option value="">All Tracks</option>
          {tracks?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filterFromDate}
          onChange={(e) => setFilterFromDate(e.target.value)}
          className="px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange"
          aria-label="From date"
          data-testid="filter-from-date"
        />
        <input
          type="date"
          value={filterToDate}
          onChange={(e) => setFilterToDate(e.target.value)}
          className="px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange"
          aria-label="To date"
          data-testid="filter-to-date"
        />
      </div>

      {events && events.length > 0 ? (
        <div className="space-y-3" data-testid="event-list">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="block p-4 bg-background-surface border border-border-subtle rounded-lg shadow-sm hover:shadow-md transition-shadow"
              data-testid="event-card"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-foreground">{event.date}</span>
                {event.conditions.condition && (
                  <span className="text-xs px-2 py-0.5 bg-background-elevated text-foreground-secondary rounded-full capitalize">
                    {event.conditions.condition}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground-secondary">
                {trackLookup.get(event.track_id) ?? 'Unknown Track'}
              </p>
              <p className="text-sm text-foreground-muted">
                {bikeLookup.get(event.bike_id) ?? 'Unknown Bike'}
              </p>
              {event.conditions.temp_c != null && (
                <p className="text-xs text-foreground-muted mt-1">
                  {event.conditions.temp_c}&deg;C
                  {event.conditions.humidity_pct != null &&
                    `, ${event.conditions.humidity_pct}% humidity`}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No events yet"
          description="Create your first track day event to start logging sessions."
          action={{ label: 'Add Event', onClick: () => setShowAdd(true) }}
        />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Event">
        <form onSubmit={handleSubmit} data-testid="add-event-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="event-bike" className="block text-sm font-medium text-foreground-secondary mb-1">
                Bike *
              </label>
              <select
                id="event-bike"
                required
                value={form.bike_id}
                onChange={(e) => setForm((f) => ({ ...f, bike_id: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange focus:border-accent-orange"
              >
                <option value="">Select a bike</option>
                {bikes?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.make} {b.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="event-track" className="block text-sm font-medium text-foreground-secondary mb-1">
                Track *
              </label>
              <select
                id="event-track"
                required
                value={form.track_id}
                onChange={(e) => setForm((f) => ({ ...f, track_id: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange focus:border-accent-orange"
              >
                <option value="">Select a track</option>
                {tracks?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="event-date" className="block text-sm font-medium text-foreground-secondary mb-1">
                Date *
              </label>
              <input
                id="event-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange focus:border-accent-orange"
              />
            </div>

            <fieldset className="border border-border-subtle rounded-lg p-4">
              <legend className="text-sm font-medium text-foreground-secondary px-1">Conditions</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cond-temp" className="block text-xs text-foreground-secondary mb-1">
                    Temp (C)
                  </label>
                  <input
                    id="cond-temp"
                    type="number"
                    value={form.conditions.temp_c ?? ''}
                    onChange={(e) =>
                      updateCondition('temp_c', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cond-humidity" className="block text-xs text-foreground-secondary mb-1">
                    Humidity (%)
                  </label>
                  <input
                    id="cond-humidity"
                    type="number"
                    min={0}
                    max={100}
                    value={form.conditions.humidity_pct ?? ''}
                    onChange={(e) =>
                      updateCondition('humidity_pct', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cond-track-temp" className="block text-xs text-foreground-secondary mb-1">
                    Track Temp (C)
                  </label>
                  <input
                    id="cond-track-temp"
                    type="number"
                    value={form.conditions.track_temp_c ?? ''}
                    onChange={(e) =>
                      updateCondition('track_temp_c', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="cond-wind" className="block text-xs text-foreground-secondary mb-1">
                    Wind (kph)
                  </label>
                  <input
                    id="cond-wind"
                    type="number"
                    min={0}
                    value={form.conditions.wind_kph ?? ''}
                    onChange={(e) =>
                      updateCondition('wind_kph', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded text-sm"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor="cond-condition" className="block text-xs text-foreground-secondary mb-1">
                  Condition
                </label>
                <select
                  id="cond-condition"
                  value={form.conditions.condition ?? ''}
                  onChange={(e) =>
                    updateCondition(
                      'condition',
                      (e.target.value || null) as Conditions['condition'],
                    )
                  }
                  className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded text-sm"
                >
                  <option value="">--</option>
                  {CONDITION_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label htmlFor="cond-notes" className="block text-xs text-foreground-secondary mb-1">
                  Notes
                </label>
                <textarea
                  id="cond-notes"
                  rows={2}
                  value={form.conditions.notes ?? ''}
                  onChange={(e) => updateCondition('notes', e.target.value || null)}
                  className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded text-sm"
                  placeholder="Weather, surface observations..."
                />
              </div>
            </fieldset>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-foreground-secondary bg-background-elevated rounded-lg hover:bg-border-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createEvent.isPending}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
            >
              {createEvent.isPending ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
