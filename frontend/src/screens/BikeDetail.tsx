import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useBike, useUpdateBike } from '@/hooks/useBikes';
import { StatusBadge } from '@/components/common/StatusBadge';
import { SuspensionSpecCard } from '@/components/garage/SuspensionSpecCard';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import MaintenanceLogScreen from '@/screens/MaintenanceLog';
import { TiresTab } from '@/components/garage/TiresTab';
import { ModsTab } from '@/components/garage/ModsTab';
import { OwnershipTab } from '@/components/garage/OwnershipTab';
import { EmptyState } from '@/components/common/EmptyState';
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
      <h4 className="text-sm font-semibold text-foreground-secondary mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs text-foreground-muted mb-1">{label}</label>
            <input
              type="number"
              value={settings[key] ?? ''}
              onChange={(e) =>
                onChange({
                  ...settings,
                  [key]: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded text-sm focus:ring-1 focus:ring-accent-orange focus:border-accent-orange"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BikeDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bike, isLoading, isError, refetch } = useBike(id);
  const updateBike = useUpdateBike();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<UpdateBikeRequest>({});
  const [editSuspension, setEditSuspension] = useState<SuspensionSpec>({
    schema_version: 1,
  });

  if (isLoading) {
    return (
      <div>
        <div className="h-4 w-32 bg-border-subtle rounded animate-pulse mb-4" />
        <div className="h-8 w-64 bg-border-subtle rounded animate-pulse mb-6" />
        <LoadingSkeleton variant="lines" count={5} />
      </div>
    );
  }

  if (isError || !bike) {
    return (
      <div>
        <Link to="/" className="text-sm text-accent-orange hover:text-accent-orange-hover mb-4 inline-block">
          &larr; Back to Garage
        </Link>
        <ErrorState message="Failed to load bike details." onRetry={() => refetch()} />
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
      <Link to="/" className="text-sm text-accent-orange hover:text-accent-orange-hover mb-4 inline-block min-h-[44px] flex items-center">
        &larr; Back to Garage
      </Link>

      {/* Bike header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground" data-testid="bike-title">
            {bike.year ? `${bike.year} ` : ''}
            {bike.make} {bike.model}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={bike.status} />
            {bike.color && <span className="text-sm text-foreground-muted">{bike.color}</span>}
          </div>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-accent-orange border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors self-start"
            data-testid="edit-button"
          >
            Edit
          </button>
        )}
      </div>

      {/* Stats bar */}
      {bike.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-background-surface rounded-lg border border-border-subtle p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{bike.stats.maintenance_count ?? 0}</p>
            <p className="text-xs text-foreground-muted">Maintenance</p>
          </div>
          <div className="bg-background-surface rounded-lg border border-border-subtle p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{bike.stats.modification_count ?? 0}</p>
            <p className="text-xs text-foreground-muted">Mods</p>
          </div>
          <div className="bg-background-surface rounded-lg border border-border-subtle p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{bike.stats.session_count ?? 0}</p>
            <p className="text-xs text-foreground-muted">Sessions</p>
          </div>
          <div className="bg-background-surface rounded-lg border border-border-subtle p-3 text-center">
            <p className="text-2xl font-bold text-foreground">
              {bike.stats.best_lap_ms != null
                ? `${(bike.stats.best_lap_ms / 1000).toFixed(3)}s`
                : '--'}
            </p>
            <p className="text-xs text-foreground-muted">Best Lap</p>
          </div>
        </div>
      )}

      {/* Tabs — horizontal scroll on mobile */}
      <div className="border-b border-border-subtle mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <nav className="flex gap-0 -mb-px whitespace-nowrap" data-testid="tab-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 min-h-[44px] text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-accent-orange'
                  : 'border-transparent text-foreground-muted hover:text-foreground-secondary hover:border-border'
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
            <div className="space-y-6 max-w-2xl" data-testid="edit-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Make</label>
                  <input
                    type="text"
                    value={editForm.make ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, make: e.target.value }))}
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Model</label>
                  <input
                    type="text"
                    value={editForm.model ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Year</label>
                  <input
                    type="number"
                    value={editForm.year ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        year: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Color</label>
                  <input
                    type="text"
                    value={editForm.color ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value || null }))}
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Mileage (km)</label>
                  <input
                    type="number"
                    value={editForm.mileage_km ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        mileage_km: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Status</label>
                  <select
                    value={editForm.status ?? 'owned'}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        status: e.target.value as UpdateBikeRequest['status'],
                      }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  >
                    <option value="owned">Owned</option>
                    <option value="sold">Sold</option>
                    <option value="stored">Stored</option>
                    <option value="in_repair">In Repair</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Exhaust</label>
                  <input
                    type="text"
                    value={editForm.exhaust ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, exhaust: e.target.value || null }))}
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">ECU</label>
                  <input
                    type="text"
                    value={editForm.ecu ?? ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, ecu: e.target.value || null }))}
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Gearing Front</label>
                  <input
                    type="number"
                    value={editForm.gearing_front ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        gearing_front: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-secondary mb-1">Gearing Rear</label>
                  <input
                    type="number"
                    value={editForm.gearing_rear ?? ''}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        gearing_rear: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-secondary mb-1">Notes</label>
                <textarea
                  value={editForm.notes ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value || null }))}
                  rows={3}
                  className="w-full px-3 py-2 min-h-[44px] border border-border rounded-lg text-sm"
                />
              </div>

              {/* Suspension editor */}
              <div className="bg-background-elevated rounded-lg p-4 border border-border-subtle space-y-4">
                <h3 className="text-sm font-semibold text-foreground-secondary">Suspension Settings</h3>
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
                  className="px-4 py-2 min-h-[44px] text-sm font-medium text-foreground-secondary bg-background-elevated rounded-lg hover:bg-border-subtle transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={updateBike.isPending}
                  className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
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
                <div className="bg-background-surface rounded-lg border border-border-subtle p-4">
                  <h3 className="text-sm font-semibold text-foreground-secondary mb-3">Specs</h3>
                  <dl className="space-y-2 text-sm">
                    {bike.mileage_km != null && (
                      <div className="flex justify-between">
                        <dt className="text-foreground-muted">Mileage</dt>
                        <dd className="font-medium text-foreground">{bike.mileage_km.toLocaleString()} km</dd>
                      </div>
                    )}
                    {bike.engine_hours != null && (
                      <div className="flex justify-between">
                        <dt className="text-foreground-muted">Engine Hours</dt>
                        <dd className="font-medium text-foreground">{bike.engine_hours}</dd>
                      </div>
                    )}
                    {(bike.gearing_front != null || bike.gearing_rear != null) && (
                      <div className="flex justify-between">
                        <dt className="text-foreground-muted">Gearing</dt>
                        <dd className="font-medium text-foreground" data-testid="gearing-value">
                          {bike.gearing_front ?? '?'}/{bike.gearing_rear ?? '?'}
                        </dd>
                      </div>
                    )}
                    {bike.exhaust && (
                      <div className="flex justify-between">
                        <dt className="text-foreground-muted">Exhaust</dt>
                        <dd className="font-medium text-foreground" data-testid="exhaust-value">{bike.exhaust}</dd>
                      </div>
                    )}
                    {bike.ecu && (
                      <div className="flex justify-between">
                        <dt className="text-foreground-muted">ECU</dt>
                        <dd className="font-medium text-foreground" data-testid="ecu-value">{bike.ecu}</dd>
                      </div>
                    )}
                    {bike.vin && (
                      <div className="flex justify-between">
                        <dt className="text-foreground-muted">VIN</dt>
                        <dd className="font-medium text-foreground font-mono text-xs">{bike.vin}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <SuspensionSpecCard spec={bike.suspension_spec} />
              </div>

              {/* Notes */}
              {bike.notes && (
                <div className="bg-background-surface rounded-lg border border-border-subtle p-4">
                  <h3 className="text-sm font-semibold text-foreground-secondary mb-2">Notes</h3>
                  <p className="text-sm text-foreground-secondary whitespace-pre-wrap" data-testid="bike-notes">{bike.notes}</p>
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
          <EmptyState
            title="No sessions yet"
            description="Track sessions for this bike will appear here."
          />
        </div>
      )}
    </div>
  );
}

