import type { MaintenanceLog } from '@/api/types';

const CATEGORY_COLORS: Record<string, string> = {
  oil_change: 'bg-amber-100 text-amber-800',
  coolant: 'bg-blue-100 text-accent-orange',
  chain: 'bg-background-elevated text-foreground',
  brakes: 'bg-red-100 text-red-800',
  tires: 'bg-green-100 text-green-800',
  valve_check: 'bg-purple-100 text-purple-800',
  air_filter: 'bg-yellow-100 text-yellow-800',
  spark_plugs: 'bg-orange-100 text-orange-800',
  general: 'bg-slate-100 text-slate-800',
};

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface MaintenanceEntryProps {
  entry: MaintenanceLog;
}

export function MaintenanceEntry({ entry }: MaintenanceEntryProps) {
  const badgeColor = CATEGORY_COLORS[entry.category] ?? 'bg-slate-100 text-slate-800';

  return (
    <div
      className="bg-background-surface rounded-lg border border-border-subtle p-4"
      data-testid="maintenance-entry"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}
              data-testid="category-badge"
            >
              {formatCategory(entry.category)}
            </span>
            <span className="text-xs text-foreground-muted">
              {new Date(entry.performed_at).toLocaleDateString()}
            </span>
          </div>
          {entry.description && (
            <p className="text-sm text-foreground mb-1">{entry.description}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
            {entry.mileage_km != null && (
              <span>{entry.mileage_km.toLocaleString()} km</span>
            )}
            {entry.cost != null && (
              <span>
                {entry.currency ?? '$'}
                {entry.cost.toFixed(2)}
              </span>
            )}
            {entry.performed_by && <span>by {entry.performed_by}</span>}
          </div>
          {entry.notes && (
            <p className="text-xs text-foreground-muted mt-1">{entry.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
