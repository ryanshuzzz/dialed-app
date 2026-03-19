import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useMaintenance,
  useUpcomingMaintenance,
  useCreateMaintenance,
} from '@/hooks/useMaintenance';
import { MaintenanceEntry } from '@/components/garage/MaintenanceEntry';
import { MaintenanceForm } from '@/components/garage/MaintenanceForm';
import { UpcomingMaintenance } from '@/components/garage/UpcomingMaintenance';
import type { CreateMaintenanceRequest } from '@/api/types';

const FILTER_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'coolant', label: 'Coolant' },
  { value: 'chain', label: 'Chain' },
  { value: 'brakes', label: 'Brakes' },
  { value: 'tires', label: 'Tires' },
  { value: 'valve_check', label: 'Valve Check' },
  { value: 'air_filter', label: 'Air Filter' },
  { value: 'spark_plugs', label: 'Spark Plugs' },
  { value: 'general', label: 'General' },
];

interface MaintenanceLogScreenProps {
  bikeId?: string;
}

export default function MaintenanceLogScreen({ bikeId: bikeIdProp }: MaintenanceLogScreenProps = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const bikeId = bikeIdProp ?? paramId ?? '';
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const filters = categoryFilter ? { category: categoryFilter } : undefined;
  const { data: entries, isLoading } = useMaintenance(bikeId, filters);
  const { data: upcoming } = useUpcomingMaintenance(bikeId);
  const createMaintenance = useCreateMaintenance();

  const handleCreate = (data: CreateMaintenanceRequest) => {
    createMaintenance.mutate(
      { bikeId, data },
      {
        onSuccess: () => setShowForm(false),
      },
    );
  };

  // Sort newest first
  const sortedEntries = entries
    ? [...entries].sort(
        (a, b) =>
          new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
      )
    : [];

  return (
    <div data-testid="maintenance-log">
      {/* Upcoming maintenance section */}
      {upcoming && upcoming.items.length > 0 && (
        <UpcomingMaintenance items={upcoming.items} />
      )}

      {/* Header with filter and add button */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Maintenance Log</h3>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            data-testid="category-filter"
          >
            {FILTER_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="add-maintenance-button"
          >
            Add Maintenance
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4">
          <MaintenanceForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isPending={createMaintenance.isPending}
          />
        </div>
      )}

      {/* Entries list */}
      {isLoading ? (
        <p className="text-gray-500 text-sm">Loading maintenance entries...</p>
      ) : sortedEntries.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No maintenance entries yet.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="maintenance-list">
          {sortedEntries.map((entry) => (
            <MaintenanceEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
