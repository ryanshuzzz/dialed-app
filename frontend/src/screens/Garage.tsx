import { useState } from 'react';
import { useBikes, useCreateBike } from '@/hooks/useBikes';
import { BikeCard } from '@/components/garage/BikeCard';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { Modal } from '@/components/common/Modal';
import type { CreateBikeRequest } from '@/api/types';

const INITIAL_FORM: CreateBikeRequest = {
  make: '',
  model: '',
  year: null,
  color: null,
  mileage_km: null,
  status: 'owned',
};

export default function Garage() {
  const { data: bikes, isLoading, isError, refetch } = useBikes();
  const createBike = useCreateBike();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CreateBikeRequest>({ ...INITIAL_FORM });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.make.trim() || !form.model.trim()) return;
    createBike.mutate(form, {
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
          <h2 className="text-2xl font-bold text-gray-900">Garage</h2>
        </div>
        <LoadingSkeleton variant="cards" count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Garage</h2>
        </div>
        <ErrorState message="Failed to load bikes. Please try again." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Garage</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 min-h-[44px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          data-testid="add-bike-button"
        >
          Add Bike
        </button>
      </div>

      {bikes && bikes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="bike-grid">
          {bikes.map((bike) => (
            <BikeCard key={bike.id} bike={bike} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No bikes yet"
          description="Add your first bike to get started with Dialed."
          action={{ label: 'Add Bike', onClick: () => setShowAdd(true) }}
        />
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Bike">
        <form onSubmit={handleSubmit} data-testid="add-bike-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                Make *
              </label>
              <input
                id="make"
                type="text"
                required
                value={form.make}
                onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Ducati"
              />
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                Model *
              </label>
              <input
                id="model"
                type="text"
                required
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Panigale V4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  id="year"
                  type="number"
                  min={1900}
                  max={2100}
                  value={form.year ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      year: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="2024"
                />
              </div>
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <input
                  id="color"
                  type="text"
                  value={form.color ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, color: e.target.value || null }))
                  }
                  className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Red"
                />
              </div>
            </div>

            <div>
              <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 mb-1">
                Mileage (km)
              </label>
              <input
                id="mileage"
                type="number"
                min={0}
                value={form.mileage_km ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mileage_km: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
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
              disabled={createBike.isPending}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createBike.isPending ? 'Adding...' : 'Add Bike'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
