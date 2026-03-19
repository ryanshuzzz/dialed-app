import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTracks, useCreateTrack } from '@/hooks/useTracks';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Modal } from '@/components/common/Modal';
import type { CreateTrackRequest } from '@/api/types';

const INITIAL_FORM: CreateTrackRequest = {
  name: '',
  config: null,
  surface_notes: null,
};

export default function Tracks() {
  const { data: tracks, isLoading, isError, refetch } = useTracks();
  const createTrack = useCreateTrack();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CreateTrackRequest>({ ...INITIAL_FORM });
  const [search, setSearch] = useState('');

  const filteredTracks = useMemo(() => {
    if (!tracks) return [];
    if (!search.trim()) return tracks;
    const q = search.toLowerCase();
    return tracks.filter((t) => t.name.toLowerCase().includes(q));
  }, [tracks, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createTrack.mutate(form, {
      onSuccess: () => {
        setShowAdd(false);
        setForm({ ...INITIAL_FORM });
      },
    });
  };

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Tracks</h2>
        </div>
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Tracks</h2>
        </div>
        <ErrorState message="Failed to load tracks. Please try again." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Tracks</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          data-testid="add-track-button"
        >
          Add Track
        </button>
      </div>

      {tracks && tracks.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search tracks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:max-w-sm px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            data-testid="track-search"
          />
        </div>
      )}

      {filteredTracks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="track-grid">
          {filteredTracks.map((track) => (
            <Link
              key={track.id}
              to={`/tracks/${track.id}`}
              className="block p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              data-testid="track-card"
            >
              <h3 className="text-lg font-semibold text-gray-900">{track.name}</h3>
              {track.config && (
                <p className="text-sm text-gray-600 mt-1">{track.config}</p>
              )}
              {track.surface_notes && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{track.surface_notes}</p>
              )}
            </Link>
          ))}
        </div>
      ) : tracks && tracks.length > 0 ? (
        <p className="text-gray-500 text-sm">No tracks match your search.</p>
      ) : (
        <EmptyState
          title="No tracks yet"
          description="Add your first track to start logging events and sessions."
          action={{ label: 'Add Track', onClick: () => setShowAdd(true) }}
        />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Track">
        <form onSubmit={handleSubmit} data-testid="add-track-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="track-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                id="track-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Mugello"
              />
            </div>

            <div>
              <label htmlFor="track-config" className="block text-sm font-medium text-gray-700 mb-1">
                Configuration
              </label>
              <input
                id="track-config"
                type="text"
                value={form.config ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, config: e.target.value || null }))}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Full Circuit, Short Course"
              />
            </div>

            <div>
              <label htmlFor="track-surface" className="block text-sm font-medium text-gray-700 mb-1">
                Surface Notes
              </label>
              <textarea
                id="track-surface"
                rows={3}
                value={form.surface_notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, surface_notes: e.target.value || null }))}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Surface type, grip conditions, etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTrack.isPending}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createTrack.isPending ? 'Adding...' : 'Add Track'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
