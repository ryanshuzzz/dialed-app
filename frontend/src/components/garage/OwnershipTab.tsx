import { useState } from 'react';
import { useOwnership, useCreateOwnershipEvent } from '@/hooks/useOwnership';
import { OwnershipEvent } from '@/components/garage/OwnershipEvent';
import type { OwnershipHistory, CreateOwnershipRequest } from '@/api/types';

const EVENT_TYPE_OPTIONS: OwnershipHistory['event_type'][] = [
  'purchased',
  'sold',
  'traded',
  'gifted',
  'transferred',
];

function formatLabel(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface OwnershipTabProps {
  bikeId: string;
}

export function OwnershipTab({ bikeId }: OwnershipTabProps) {
  const { data: events, isLoading } = useOwnership(bikeId);
  const createEvent = useCreateOwnershipEvent();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [eventType, setEventType] = useState<OwnershipHistory['event_type']>('purchased');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [price, setPrice] = useState('');
  const [mileageKm, setMileageKm] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateOwnershipRequest = {
      event_type: eventType,
      date,
      price: price ? Number(price) : null,
      mileage_km: mileageKm ? Number(mileageKm) : null,
      counterparty: counterparty || null,
      notes: notes || null,
    };
    createEvent.mutate(
      { bikeId, data },
      {
        onSuccess: () => {
          setShowForm(false);
          setEventType('purchased');
          setDate(new Date().toISOString().split('T')[0]);
          setPrice('');
          setMileageKm('');
          setCounterparty('');
          setNotes('');
        },
      },
    );
  };

  const sortedEvents = events
    ? [...events].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Ownership History</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover transition-colors"
            data-testid="add-ownership-button"
          >
            Add Event
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-background-surface rounded-lg border border-border-subtle p-4 mb-4 space-y-4"
          data-testid="ownership-form"
        >
          <h4 className="text-sm font-semibold text-foreground">Add Ownership Event</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="own-event-type" className="block text-xs font-medium text-foreground-secondary mb-1">
                Event Type
              </label>
              <select
                id="own-event-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as OwnershipHistory['event_type'])}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {EVENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {formatLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="own-date" className="block text-xs font-medium text-foreground-secondary mb-1">
                Date
              </label>
              <input
                id="own-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="own-price" className="block text-xs font-medium text-foreground-secondary mb-1">
                Price
              </label>
              <input
                id="own-price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="own-mileage" className="block text-xs font-medium text-foreground-secondary mb-1">
                Mileage (km)
              </label>
              <input
                id="own-mileage"
                type="number"
                value={mileageKm}
                onChange={(e) => setMileageKm(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="own-counterparty" className="block text-xs font-medium text-foreground-secondary mb-1">
                Counterparty
              </label>
              <input
                id="own-counterparty"
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g. Dealer name"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="own-notes" className="block text-xs font-medium text-foreground-secondary mb-1">
                Notes
              </label>
              <input
                id="own-notes"
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
              disabled={createEvent.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
              data-testid="submit-ownership"
            >
              {createEvent.isPending ? 'Saving...' : 'Add Event'}
            </button>
          </div>
        </form>
      )}

      {/* Events timeline */}
      {isLoading ? (
        <p className="text-foreground-muted text-sm">Loading ownership history...</p>
      ) : sortedEvents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-foreground-muted text-sm">No ownership events yet.</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="ownership-list">
          {sortedEvents.map((event) => (
            <OwnershipEvent key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
