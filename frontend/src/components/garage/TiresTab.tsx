import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTirePressure, useCreateTirePressure } from '@/hooks/useTirePressure';
import { TirePressureChart } from '@/components/garage/TirePressureChart';
import type { TirePressureLog, CreateTirePressureRequest } from '@/api/types';

const CONTEXT_OPTIONS: { value: TirePressureLog['context']; label: string }[] = [
  { value: 'cold', label: 'Cold' },
  { value: 'pre_ride', label: 'Pre-Ride' },
  { value: 'post_ride', label: 'Post-Ride' },
  { value: 'pit_stop', label: 'Pit Stop' },
  { value: 'pre_session', label: 'Pre-Session' },
  { value: 'post_session', label: 'Post-Session' },
];

const CONTEXT_BADGE_COLORS: Record<string, string> = {
  cold: 'bg-blue-100 text-accent-orange',
  pre_ride: 'bg-green-100 text-green-800',
  post_ride: 'bg-amber-100 text-amber-800',
  pit_stop: 'bg-purple-100 text-purple-800',
  pre_session: 'bg-teal-100 text-teal-800',
  post_session: 'bg-red-100 text-red-800',
};

function formatContext(context: string): string {
  return context
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface TiresTabProps {
  bikeId: string;
}

export function TiresTab({ bikeId }: TiresTabProps) {
  const { data: readings, isLoading } = useTirePressure(bikeId);
  const createReading = useCreateTirePressure();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [frontPsi, setFrontPsi] = useState('');
  const [rearPsi, setRearPsi] = useState('');
  const [frontTempC, setFrontTempC] = useState('');
  const [rearTempC, setRearTempC] = useState('');
  const [context, setContext] = useState<TirePressureLog['context']>('cold');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateTirePressureRequest = {
      front_psi: frontPsi ? Number(frontPsi) : null,
      rear_psi: rearPsi ? Number(rearPsi) : null,
      front_temp_c: frontTempC ? Number(frontTempC) : null,
      rear_temp_c: rearTempC ? Number(rearTempC) : null,
      context,
      notes: notes || null,
      recorded_at: new Date().toISOString(),
    };
    createReading.mutate(
      { bikeId, data },
      {
        onSuccess: () => {
          setShowForm(false);
          setFrontPsi('');
          setRearPsi('');
          setFrontTempC('');
          setRearTempC('');
          setContext('cold');
          setNotes('');
        },
      },
    );
  };

  const sortedReadings = readings
    ? [...readings].sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      )
    : [];

  return (
    <div>
      {/* Chart */}
      <TirePressureChart readings={sortedReadings} />

      {/* Header with add button */}
      <div className="flex items-center justify-between mt-6 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Readings</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover transition-colors"
            data-testid="add-tire-pressure-button"
          >
            Log Pressure
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-background-surface rounded-lg border border-border-subtle p-4 mb-4 space-y-4"
          data-testid="tire-pressure-form"
        >
          <h4 className="text-sm font-semibold text-foreground">Log Tire Pressure</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tp-front-psi" className="block text-xs font-medium text-foreground-secondary mb-1">
                Front PSI
              </label>
              <input
                id="tp-front-psi"
                type="number"
                step="0.1"
                value={frontPsi}
                onChange={(e) => setFrontPsi(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="tp-rear-psi" className="block text-xs font-medium text-foreground-secondary mb-1">
                Rear PSI
              </label>
              <input
                id="tp-rear-psi"
                type="number"
                step="0.1"
                value={rearPsi}
                onChange={(e) => setRearPsi(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="tp-front-temp" className="block text-xs font-medium text-foreground-secondary mb-1">
                Front Temp (C)
              </label>
              <input
                id="tp-front-temp"
                type="number"
                value={frontTempC}
                onChange={(e) => setFrontTempC(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="tp-rear-temp" className="block text-xs font-medium text-foreground-secondary mb-1">
                Rear Temp (C)
              </label>
              <input
                id="tp-rear-temp"
                type="number"
                value={rearTempC}
                onChange={(e) => setRearTempC(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="tp-context" className="block text-xs font-medium text-foreground-secondary mb-1">
                Context
              </label>
              <select
                id="tp-context"
                value={context}
                onChange={(e) => setContext(e.target.value as TirePressureLog['context'])}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {CONTEXT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tp-notes" className="block text-xs font-medium text-foreground-secondary mb-1">
                Notes
              </label>
              <input
                id="tp-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-foreground-secondary bg-background-elevated rounded-lg hover:bg-border-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createReading.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
              data-testid="submit-tire-pressure"
            >
              {createReading.isPending ? 'Saving...' : 'Log Reading'}
            </button>
          </div>
        </form>
      )}

      {/* Readings list */}
      {isLoading ? (
        <p className="text-foreground-muted text-sm">Loading tire pressure readings...</p>
      ) : sortedReadings.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-foreground-muted text-sm">No tire pressure readings yet.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="tire-pressure-list">
          {sortedReadings.map((reading) => {
            const badgeColor = CONTEXT_BADGE_COLORS[reading.context] ?? 'bg-slate-100 text-slate-800';
            return (
              <div
                key={reading.id}
                className="bg-background-surface rounded-lg border border-border-subtle p-4"
                data-testid="tire-pressure-reading"
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}
                    data-testid="context-badge"
                  >
                    {formatContext(reading.context)}
                  </span>
                  <span className="text-xs text-foreground-muted">
                    {new Date(reading.recorded_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {reading.front_psi != null && (
                    <span>
                      <span className="text-foreground-muted">Front:</span>{' '}
                      <span className="font-medium text-foreground">{reading.front_psi} psi</span>
                      {reading.front_temp_c != null && (
                        <span className="text-xs text-foreground-muted ml-1">({reading.front_temp_c}°C)</span>
                      )}
                    </span>
                  )}
                  {reading.rear_psi != null && (
                    <span>
                      <span className="text-foreground-muted">Rear:</span>{' '}
                      <span className="font-medium text-foreground">{reading.rear_psi} psi</span>
                      {reading.rear_temp_c != null && (
                        <span className="text-xs text-foreground-muted ml-1">({reading.rear_temp_c}°C)</span>
                      )}
                    </span>
                  )}
                </div>
                {reading.session_id && (
                  <div className="mt-1">
                    <Link
                      to={`/sessions/${reading.session_id}`}
                      className="text-xs text-accent-orange hover:text-accent-orange-hover"
                    >
                      View linked session
                    </Link>
                  </div>
                )}
                {reading.notes && (
                  <p className="text-xs text-foreground-muted mt-1">{reading.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
