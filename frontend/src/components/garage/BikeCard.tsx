import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Bike } from '@/api/types';

interface BikeCardProps {
  bike: Bike;
}

export function BikeCard({ bike }: BikeCardProps) {
  return (
    <Link
      to={`/bikes/${bike.id}`}
      className="block bg-background-surface rounded-xl border border-border-subtle p-4 hover:shadow-md transition-shadow"
      data-testid="bike-card"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {bike.year ? `${bike.year} ` : ''}
            {bike.make} {bike.model}
          </h3>
          {bike.color && (
            <p className="text-sm text-foreground-muted mt-0.5">{bike.color}</p>
          )}
        </div>
        <StatusBadge status={bike.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {bike.mileage_km != null && (
          <div>
            <span className="text-foreground-muted">Mileage</span>
            <p className="font-medium text-foreground">{bike.mileage_km.toLocaleString()} km</p>
          </div>
        )}
        {bike.exhaust && (
          <div>
            <span className="text-foreground-muted">Exhaust</span>
            <p className="font-medium text-foreground truncate">{bike.exhaust}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
