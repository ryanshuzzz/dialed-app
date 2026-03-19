import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTrack, useUpdateTrack, useDeleteTrack } from '@/hooks/useTracks';
import { useEvents } from '@/hooks/useEvents';
import { Modal } from '@/components/common/Modal';
import type { UpdateTrackRequest } from '@/api/types';

export default function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: track, isLoading, isError } = useTrack(id);
  const { data: events } = useEvents(id ? { track_id: id } : undefined);
  const updateTrack = useUpdateTrack();
  const deleteTrack = useDeleteTrack();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateTrackRequest>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const startEdit = () => {
    if (!track) return;
    setForm({
      name: track.name,
      config: track.config,
      surface_notes: track.surface_notes,
    });
    setEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !form.name?.trim()) return;
    updateTrack.mutate(
      { trackId: id, data: form },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  const handleDelete = () => {
    if (!id) return;
    deleteTrack.mutate(id, {
      onSuccess: () => navigate('/tracks'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading track...</p>
      </div>
    );
  }

  if (isError || !track) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Failed to load track.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/tracks" className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to Tracks
        </Link>
      </div>

      {editing ? (
        <form onSubmit={handleSave} data-testid="edit-track-form">
          <div className="space-y-4 max-w-lg">
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                id="edit-name"
                type="text"
                required
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="edit-config" className="block text-sm font-medium text-gray-700 mb-1">
                Configuration
              </label>
              <input
                id="edit-config"
                type="text"
                value={form.config ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, config: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="edit-surface" className="block text-sm font-medium text-gray-700 mb-1">
                Surface Notes
              </label>
              <textarea
                id="edit-surface"
                rows={3}
                value={form.surface_notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, surface_notes: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateTrack.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {updateTrack.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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
              <h2 className="text-2xl font-bold text-gray-900" data-testid="track-name">
                {track.name}
              </h2>
              {track.config && (
                <p className="text-sm text-gray-600 mt-1" data-testid="track-config">
                  {track.config}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={startEdit}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                data-testid="edit-track-button"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                data-testid="delete-track-button"
              >
                Delete
              </button>
            </div>
          </div>

          {track.surface_notes && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Surface Notes</h3>
              <p className="text-sm text-gray-600" data-testid="track-surface-notes">
                {track.surface_notes}
              </p>
            </div>
          )}

          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Events at this track</h3>
              <Link
                to={`/events?track_id=${track.id}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Add Event
              </Link>
            </div>

            {events && events.length > 0 ? (
              <div className="space-y-2" data-testid="track-events-list">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="block p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                    data-testid="track-event-item"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{event.date}</span>
                      {event.conditions.condition && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">
                          {event.conditions.condition}
                        </span>
                      )}
                    </div>
                    {event.conditions.temp_c != null && (
                      <p className="text-xs text-gray-500 mt-1">
                        {event.conditions.temp_c}&deg;C
                        {event.conditions.track_temp_c != null &&
                          ` / Track: ${event.conditions.track_temp_c}\u00B0C`}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No events at this track yet.</p>
            )}
          </div>
        </div>
      )}

      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Track"
      >
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete <strong>{track.name}</strong>? This action cannot be
          undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteTrack.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            data-testid="confirm-delete-button"
          >
            {deleteTrack.isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
