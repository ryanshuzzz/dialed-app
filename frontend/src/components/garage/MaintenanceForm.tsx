import { useState } from 'react';
import type { CreateMaintenanceRequest } from '@/api/types';

const CATEGORIES = [
  'oil_change',
  'coolant',
  'chain',
  'brakes',
  'tires',
  'valve_check',
  'air_filter',
  'spark_plugs',
  'general',
];

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface MaintenanceFormProps {
  onSubmit: (data: CreateMaintenanceRequest) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function MaintenanceForm({ onSubmit, onCancel, isPending }: MaintenanceFormProps) {
  const [category, setCategory] = useState('oil_change');
  const [description, setDescription] = useState('');
  const [performedAt, setPerformedAt] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [mileageKm, setMileageKm] = useState('');
  const [cost, setCost] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [nextDueKm, setNextDueKm] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      category,
      description: description || null,
      performed_at: new Date(performedAt).toISOString(),
      mileage_km: mileageKm ? Number(mileageKm) : null,
      cost: cost ? Number(cost) : null,
      performed_by: performedBy || null,
      next_due_km: nextDueKm ? Number(nextDueKm) : null,
      next_due_date: nextDueDate ? new Date(nextDueDate).toISOString() : null,
      notes: notes || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-background-surface rounded-lg border border-border-subtle p-4 space-y-4"
      data-testid="maintenance-form"
    >
      <h3 className="text-sm font-semibold text-foreground">Add Maintenance</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="maint-category" className="block text-xs font-medium text-foreground-secondary mb-1">
            Category
          </label>
          <select
            id="maint-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            data-testid="category-select"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategory(cat)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="maint-date" className="block text-xs font-medium text-foreground-secondary mb-1">
            Date
          </label>
          <input
            id="maint-date"
            type="date"
            value={performedAt}
            onChange={(e) => setPerformedAt(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="maint-description" className="block text-xs font-medium text-foreground-secondary mb-1">
            Description
          </label>
          <input
            id="maint-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was done?"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div>
          <label htmlFor="maint-mileage" className="block text-xs font-medium text-foreground-secondary mb-1">
            Mileage (km)
          </label>
          <input
            id="maint-mileage"
            type="number"
            value={mileageKm}
            onChange={(e) => setMileageKm(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div>
          <label htmlFor="maint-cost" className="block text-xs font-medium text-foreground-secondary mb-1">
            Cost
          </label>
          <input
            id="maint-cost"
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div>
          <label htmlFor="maint-performed-by" className="block text-xs font-medium text-foreground-secondary mb-1">
            Performed By
          </label>
          <input
            id="maint-performed-by"
            type="text"
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
            placeholder="Self, dealer, etc."
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div>
          <label htmlFor="maint-next-due-km" className="block text-xs font-medium text-foreground-secondary mb-1">
            Next Due (km)
          </label>
          <input
            id="maint-next-due-km"
            type="number"
            value={nextDueKm}
            onChange={(e) => setNextDueKm(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div>
          <label htmlFor="maint-next-due-date" className="block text-xs font-medium text-foreground-secondary mb-1">
            Next Due Date
          </label>
          <input
            id="maint-next-due-date"
            type="date"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="maint-notes" className="block text-xs font-medium text-foreground-secondary mb-1">
            Notes
          </label>
          <textarea
            id="maint-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-foreground-secondary bg-background-elevated rounded-lg hover:bg-border-subtle transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
          data-testid="submit-maintenance"
        >
          {isPending ? 'Saving...' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
}
