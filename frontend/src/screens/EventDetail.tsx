import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEvent, useUpdateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { useBikes } from '@/hooks/useBikes';
import { useTrack } from '@/hooks/useTracks';
import { Modal } from '@/components/common/Modal';
import type { Conditions, UpdateEventRequest } from '@/api/types';

const CONDITION_OPTIONS = ['dry', 'damp', 'wet', 'mixed'] as const;

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, isError } = useEvent(id);
  const { data: bikes } = useBikes();
  const { data: track } = useTrack(event?.track_id ?? undefined);
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editConditions, setEditConditions] = useState<Conditions>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const bikeName = bikes?.find((b) => b.id === event?.bike_id);

  const startEdit = () => {
    if (!event) return;
    setEditDate(event.date);
    setEditConditions({ ...event.conditions });
    setEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editDate) return;
    const data: UpdateEventRequest = {
      date: editDate,
      conditions: editConditions,
    };
    updateEvent.mutate(
      { eventId: id, data },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  const handleDelete = () => {
    if (!id) return;
    deleteEvent.mutate(id, {
      onSuccess: () => navigate('/events'),
    });
  };

  const updateCondition = <K extends keyof Conditions>(key: K, value: Conditions[K]) => {
    setEditConditions((c) => ({ ...c, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-foreground-muted">Loading event...</p>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Failed to load event.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/events" className="text-sm text-accent-orange hover:text-accent-orange-hover">
          &larr; Back to Events
        </Link>
      </div>

      {editing ? (
        <form onSubmit={handleSave} data-testid="edit-event-form">
          <div className="space-y-4 max-w-lg">
            <div>
              <label htmlFor="edit-date" className="block text-sm font-medium text-foreground-secondary mb-1">
                Date *
              </label>
              <input
                id="edit-date"
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-1 focus:ring-accent-orange focus:border-accent-orange"
              />
            </div>

            <fieldset className="border border-border-subtle rounded-lg p-4">
              <legend className="text-sm font-medium text-foreground-secondary px-1">Conditions</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-temp" className="block text-xs text-foreground-secondary mb-1">
                    Temp (C)
                  </label>
                  <input
                    id="edit-temp"
                    type="number"
                    value={editConditions.temp_c ?? ''}
                    onChange={(e) =>
                      updateCondition('temp_c', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-humidity" className="block text-xs text-foreground-secondary mb-1">
                    Humidity (%)
                  </label>
                  <input
                    id="edit-humidity"
                    type="number"
                    min={0}
                    max={100}
                    value={editConditions.humidity_pct ?? ''}
                    onChange={(e) =>
                      updateCondition('humidity_pct', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-track-temp" className="block text-xs text-foreground-secondary mb-1">
                    Track Temp (C)
                  </label>
                  <input
                    id="edit-track-temp"
                    type="number"
                    value={editConditions.track_temp_c ?? ''}
                    onChange={(e) =>
                      updateCondition('track_temp_c', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 border border-border rounded text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-wind" className="block text-xs text-foreground-secondary mb-1">
                    Wind (kph)
                  </label>
                  <input
                    id="edit-wind"
                    type="number"
                    min={0}
                    value={editConditions.wind_kph ?? ''}
                    onChange={(e) =>
                      updateCondition('wind_kph', e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full px-2 py-1.5 border border-border rounded text-sm"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label htmlFor="edit-condition" className="block text-xs text-foreground-secondary mb-1">
                  Condition
                </label>
                <select
                  id="edit-condition"
                  value={editConditions.condition ?? ''}
                  onChange={(e) =>
                    updateCondition(
                      'condition',
                      (e.target.value || null) as Conditions['condition'],
                    )
                  }
                  className="w-full px-2 py-1.5 border border-border rounded text-sm"
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
                <label htmlFor="edit-cond-notes" className="block text-xs text-foreground-secondary mb-1">
                  Notes
                </label>
                <textarea
                  id="edit-cond-notes"
                  rows={2}
                  value={editConditions.notes ?? ''}
                  onChange={(e) => updateCondition('notes', e.target.value || null)}
                  className="w-full px-2 py-1.5 border border-border rounded text-sm"
                />
              </div>
            </fieldset>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateEvent.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
              >
                {updateEvent.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm font-medium text-foreground-secondary bg-background-elevated rounded-lg hover:bg-border-subtle transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground" data-testid="event-track-name">
                {track?.name ?? 'Loading track...'}
              </h2>
              <p className="text-sm text-foreground-secondary mt-1" data-testid="event-date">
                {event.date}
              </p>
              {bikeName && (
                <p className="text-sm text-foreground-muted" data-testid="event-bike-name">
                  {bikeName.make} {bikeName.model}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={startEdit}
                className="px-3 py-1.5 text-sm font-medium text-foreground-secondary bg-background-elevated rounded-lg hover:bg-border-subtle transition-colors"
                data-testid="edit-event-button"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                data-testid="delete-event-button"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Conditions display */}
          <div className="mb-8 p-4 bg-background-elevated rounded-lg" data-testid="event-conditions">
            <h3 className="text-sm font-medium text-foreground-secondary mb-2">Conditions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {event.conditions.condition && (
                <div>
                  <span className="text-foreground-muted">Weather:</span>{' '}
                  <span className="capitalize font-medium">{event.conditions.condition}</span>
                </div>
              )}
              {event.conditions.temp_c != null && (
                <div>
                  <span className="text-foreground-muted">Air Temp:</span>{' '}
                  <span className="font-medium">{event.conditions.temp_c}&deg;C</span>
                </div>
              )}
              {event.conditions.track_temp_c != null && (
                <div>
                  <span className="text-foreground-muted">Track Temp:</span>{' '}
                  <span className="font-medium">{event.conditions.track_temp_c}&deg;C</span>
                </div>
              )}
              {event.conditions.humidity_pct != null && (
                <div>
                  <span className="text-foreground-muted">Humidity:</span>{' '}
                  <span className="font-medium">{event.conditions.humidity_pct}%</span>
                </div>
              )}
              {event.conditions.wind_kph != null && (
                <div>
                  <span className="text-foreground-muted">Wind:</span>{' '}
                  <span className="font-medium">{event.conditions.wind_kph} kph</span>
                </div>
              )}
            </div>
            {event.conditions.notes && (
              <p className="text-sm text-foreground-secondary mt-2">{event.conditions.notes}</p>
            )}
          </div>

          {/* Sessions at this event */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Sessions</h3>
              <Link
                to={`/sessions/new?event_id=${event.id}`}
                className="px-3 py-1.5 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover transition-colors"
                data-testid="add-session-button"
              >
                Add Session
              </Link>
            </div>
            <p className="text-sm text-foreground-muted">
              Sessions for this event will appear here once the session logger is built.
            </p>
          </div>
        </div>
      )}

      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Event"
      >
        <p className="text-sm text-foreground-secondary mb-6">
          Are you sure you want to delete this event on <strong>{event.date}</strong>? This action
          cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-sm font-medium text-foreground-secondary bg-background-elevated rounded-lg hover:bg-border-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteEvent.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            data-testid="confirm-delete-button"
          >
            {deleteEvent.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
