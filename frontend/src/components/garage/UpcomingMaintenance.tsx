import type { UpcomingMaintenanceItem } from '@/api/types';

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface UpcomingMaintenanceProps {
  items: UpcomingMaintenanceItem[];
}

export function UpcomingMaintenance({ items }: UpcomingMaintenanceProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6"
      data-testid="upcoming-maintenance"
    >
      <h3 className="text-sm font-semibold text-amber-800 mb-3">
        Upcoming Maintenance
      </h3>
      <div className="space-y-2">
        {items.map((item) => {
          const isDueSoon =
            item.next_due_date &&
            new Date(item.next_due_date).getTime() - Date.now() <
              7 * 24 * 60 * 60 * 1000;
          const isMileageDue =
            item.next_due_km != null &&
            item.current_mileage_km != null &&
            item.next_due_km - item.current_mileage_km < 500;

          return (
            <div
              key={item.id}
              className={`flex items-center justify-between p-2 rounded ${
                isDueSoon || isMileageDue
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-background-surface border border-amber-100'
              }`}
              data-testid="upcoming-item"
            >
              <div>
                <span className="text-sm font-medium text-foreground">
                  {formatCategory(item.category)}
                </span>
                <span className="text-xs text-foreground-muted ml-2">
                  Last: {new Date(item.performed_at).toLocaleDateString()}
                </span>
              </div>
              <div className="text-right text-xs text-foreground-secondary">
                {item.next_due_date && (
                  <div>
                    Due:{' '}
                    <span
                      className={
                        isDueSoon ? 'text-red-600 font-medium' : ''
                      }
                    >
                      {new Date(item.next_due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {item.next_due_km != null && (
                  <div>
                    Due at:{' '}
                    <span
                      className={
                        isMileageDue ? 'text-red-600 font-medium' : ''
                      }
                    >
                      {item.next_due_km.toLocaleString()} km
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
