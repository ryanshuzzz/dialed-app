import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBike, useUpdateBike } from '@/hooks/useBikes';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SuspensionSpecCard } from '@/components/garage/SuspensionSpecCard';
import MaintenanceLogScreen from '@/screens/MaintenanceLog';
import { TiresTab } from '@/components/garage/TiresTab';
import { ModsTab } from '@/components/garage/ModsTab';
import { OwnershipTab } from '@/components/garage/OwnershipTab';
import type { UpdateBikeRequest, SuspensionSpec, SuspensionEndSettings } from '@/api/types';

type TabId = 'overview' | 'maintenance' | 'tires' | 'mods' | 'ownership' | 'sessions';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'tires', label: 'Tires' },
  { id: 'mods', label: 'Mods' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'sessions', label: 'Sessions' },
];

function SuspensionEndEditor({
  title,
  settings,
  onChange,
}: {
  title: string;
  settings: SuspensionEndSettings;
  onChange: (s: SuspensionEndSettings) => void;
}) {
  const fields: { key: keyof SuspensionEndSettings; label: string }[] = [
    { key: 'compression', label: 'Compression' },
    { key: 'rebound', label: 'Rebound' },
    { key: 'preload', label: 'Preload' },
    { key: 'spring_rate', label: 'Spring Rate' },
    { key: 'oil_level', label: 'Oil Level' },
    { key: 'ride_height', label: 'Ride Height' },
  ];

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input
              type="number"
              value={settings[key] ?? ''}
              onChange={(e) =>
                onChange({
                  ...settings,
                  [key]: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BikeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bike, isLoading, isError } = useBike(id);
  const updateBike = useUpdateBike();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateBikeRequest>({});
  const [editSuspension, setEditSuspension] = useState<SuspensionSpec>({
    schema_version: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading bike details...</p>
      </div>
    );
  }

  if (isError || !bike) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">Failed to load bike details.</p>
      </div>
    );
  }

  const startEdit = () => {
    setEditForm({
      make: bike.make,
      model: bike.model,
      year: bike.year,
      color: bike.color,
      mileage_km: bike.mileage_km,
      exhaust: bike.exhaust,
      ecu: bike.ecu,
      gearing_front: bike.gearing_front,
      gearing_rear: bike.gearing_rear,
      notes: bike.notes,
      status: bike.status,
    });
    setEditSuspension({
      schema_version: 1,
      front: { ...bike.suspension_spec.front },
      rear: { ...bike.suspension_spec.rear },
    });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!id) return;
    updateBike.mutate(
      { bikeId: id, data: { ...editForm, suspension_spec: editSuspension } },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  return (
    <div>
      {/* Back link */}
      <Link to="/" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block">
        &larr; Back to Garage
      </Link>

      {/* Bike header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900" data-testid="bike-title">
            {bike.year ? `${bike.year} ` : ''}
            {bike.make} {bike.model}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={bike.status} />
            {bike.color && <span className="text-sm text-gray-500">{bike.color}</span>}
          </div>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            data-testid="edit-button"
          >
            Edit
          </button>
        )}
      </div>

      {/* Stats bar */}
      {bike.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{bike.stats.maintenance_count ?? 0}</p>
            <p className="text-xs text-gray-500">Maintenance</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{bike.stats.modification_count ?? 0}</p>
            <p className="text-xs text-gray-500">Mods</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{bike.stats.session_count ?? 0}</p>
            <p className="text-xs text-gray-500">Sessions</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {bike.stats.best_lap_ms != null
                ? `${(bike.stats.best_lap_ms / 1000).toFixed(3)}s`
                : '--'}
            </p>
            <p className="text-xs text-gray-500">Best Lap</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <nav className="flex gap-0 -mb-px" data-testid="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div data-testid="overview-tab">
          {editing ? (
            <div className="space-y-6" data-testid="edit-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                  <input
                    type="text"
                    value={editForm.make ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, make: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={editForm.model ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input
                    type="number"
                    value={editForm.year ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        year: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="text"
                    value={editForm.color ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mileage (km)</label>
                  <input
                    type="number"
                    value={editForm.mileage_km ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        mileage_km: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editForm.status ?? 'owned'}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        status: e.target.value as UpdateBikeRequest['status'],
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="owned">Owned</option>
                    <option value="sold">Sold</option>
                    <option value="stored">Stored</option>
                    <option value="in_repair">In Repair</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exhaust</label>
                  <input
                    type="text"
                    value={editForm.exhaust ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, exhaust: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ECU</label>
                  <input
                    type="text"
                    value={editForm.ecu ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, ecu: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gearing Front</label>
                  <input
                    type="number"
                    value={editForm.gearing_front ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        gearing_front: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gearing Rear</label>
                  <input
                    type="number"
                    value={editForm.gearing_rear ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        gearing_rear: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editForm.notes ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value || null }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Suspension editor */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Suspension Settings</h3>
                <SuspensionEndEditor
                  title="Front"
                  settings={editSuspension.front ?? {}}
                  onChange={(front) => setEditSuspension((s) => ({ ...s, front }))}
                />
                <SuspensionEndEditor
                  title="Rear"
                  settings={editSuspension.rear ?? {}}
                  onChange={(rear) => setEditSuspension((s) => ({ ...s, rear }))}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={updateBike.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  data-testid="save-button"
                >
                  {updateBike.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Key specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Specs</h3>
                  <dl className="space-y-2 text-sm">
                    {bike.mileage_km != null && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Mileage</dt>
                        <dd className="font-medium text-gray-900">{bike.mileage_km.toLocaleString()} km</dd>
                      </div>
                    )}
                    {bike.engine_hours != null && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Engine Hours</dt>
                        <dd className="font-medium text-gray-900">{bike.engine_hours}</dd>
                      </div>
                    )}
                    {(bike.gearing_front != null || bike.gearing_rear != null) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Gearing</dt>
                        <dd className="font-medium text-gray-900" data-testid="gearing-value">
                          {bike.gearing_front ?? '?'}/{bike.gearing_rear ?? '?'}
                        </dd>
                      </div>
                    )}
                    {bike.exhaust && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Exhaust</dt>
                        <dd className="font-medium text-gray-900" data-testid="exhaust-value">{bike.exhaust}</dd>
                      </div>
                    )}
                    {bike.ecu && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">ECU</dt>
                        <dd className="font-medium text-gray-900" data-testid="ecu-value">{bike.ecu}</dd>
                      </div>
                    )}
                    {bike.vin && (
                      <div className="flex justify-between">
                        <dt className="text-gray-500">VIN</dt>
                        <dd className="font-medium text-gray-900 font-mono text-xs">{bike.vin}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <SuspensionSpecCard spec={bike.suspension_spec} />
              </div>

              {/* Notes */}
              {bike.notes && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap" data-testid="bike-notes">{bike.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div data-testid="maintenance-tab">
          {id && <MaintenanceLogScreen bikeId={id} />}
        </div>
      )}

      {activeTab === 'tires' && (
        <div data-testid="tires-tab">
          {id && <TiresTab bikeId={id} />}
        </div>
      )}

      {activeTab === 'mods' && (
        <div data-testid="mods-tab">
          {id && <ModsTab bikeId={id} />}
        </div>
      )}

      {activeTab === 'ownership' && (
        <div data-testid="ownership-tab">
          {id && <OwnershipTab bikeId={id} />}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div data-testid="sessions-tab">
          <p className="text-gray-500 text-sm">Track sessions coming soon.</p>
        </div>
      )}
    </div>
  );
}
