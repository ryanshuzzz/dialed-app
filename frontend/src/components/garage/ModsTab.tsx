import { useState } from 'react';
import { useModifications, useCreateModification } from '@/hooks/useModifications';
import { ModRow } from '@/components/garage/ModRow';
import type { Modification, CreateModificationRequest } from '@/api/types';
import { MODIFICATION_CATEGORIES } from '@/constants/modificationCategories';

const ACTION_OPTIONS: Modification['action'][] = [
  'installed',
  'removed',
  'swapped',
  'upgraded',
  'repaired',
];

function formatLabel(str: string): string {
  return str
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface ModsTabProps {
  bikeId: string;
}

export function ModsTab({ bikeId }: ModsTabProps) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const filters = categoryFilter ? { category: categoryFilter } : undefined;
  const { data: mods, isLoading } = useModifications(bikeId, filters);
  const createMod = useCreateModification();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [action, setAction] = useState<Modification['action']>('installed');
  const [category, setCategory] = useState<string>('suspension');
  const [partName, setPartName] = useState('');
  const [brand, setBrand] = useState('');
  const [cost, setCost] = useState('');
  const [installedAt, setInstalledAt] = useState(new Date().toISOString().split('T')[0]);
  const [removedAt, setRemovedAt] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateModificationRequest = {
      action,
      category,
      part_name: partName,
      brand: brand || null,
      cost: cost ? Number(cost) : null,
      installed_at: new Date(installedAt).toISOString(),
      removed_at: removedAt ? new Date(removedAt).toISOString() : null,
      notes: notes || null,
    };
    createMod.mutate(
      { bikeId, data },
      {
        onSuccess: () => {
          setShowForm(false);
          setAction('installed');
          setCategory('suspension');
          setPartName('');
          setBrand('');
          setCost('');
          setInstalledAt(new Date().toISOString().split('T')[0]);
          setRemovedAt('');
          setNotes('');
        },
      },
    );
  };

  const installed = mods?.filter((m) => m.removed_at === null) ?? [];
  const removed = mods?.filter((m) => m.removed_at !== null) ?? [];

  return (
    <div>
      {/* Header with filter and add button */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground">Modifications</h3>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-border rounded-lg text-sm"
            data-testid="mod-category-filter"
          >
            <option value="">All Categories</option>
            {MODIFICATION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {formatLabel(cat)}
              </option>
            ))}
          </select>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover transition-colors"
            data-testid="add-mod-button"
          >
            Add Mod
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-background-surface rounded-lg border border-border-subtle p-4 mb-4 space-y-4"
          data-testid="mod-form"
        >
          <h4 className="text-sm font-semibold text-foreground">Add Modification</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mod-action" className="block text-xs font-medium text-foreground-secondary mb-1">
                Action
              </label>
              <select
                id="mod-action"
                value={action}
                onChange={(e) => setAction(e.target.value as Modification['action'])}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {formatLabel(a)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mod-category" className="block text-xs font-medium text-foreground-secondary mb-1">
                Category
              </label>
              <select
                id="mod-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              >
                {MODIFICATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatLabel(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mod-part-name" className="block text-xs font-medium text-foreground-secondary mb-1">
                Part Name
              </label>
              <input
                id="mod-part-name"
                type="text"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="e.g. Full System Exhaust"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="mod-brand" className="block text-xs font-medium text-foreground-secondary mb-1">
                Brand
              </label>
              <input
                id="mod-brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Akrapovic"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="mod-cost" className="block text-xs font-medium text-foreground-secondary mb-1">
                Cost
              </label>
              <input
                id="mod-cost"
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="mod-installed-at" className="block text-xs font-medium text-foreground-secondary mb-1">
                Installed Date
              </label>
              <input
                id="mod-installed-at"
                type="date"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="mod-removed-at" className="block text-xs font-medium text-foreground-secondary mb-1">
                Removed Date
              </label>
              <input
                id="mod-removed-at"
                type="date"
                value={removedAt}
                onChange={(e) => setRemovedAt(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label htmlFor="mod-notes" className="block text-xs font-medium text-foreground-secondary mb-1">
                Notes
              </label>
              <input
                id="mod-notes"
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
              disabled={createMod.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-accent-orange rounded-lg hover:bg-accent-orange-hover disabled:opacity-50 transition-colors"
              data-testid="submit-mod"
            >
              {createMod.isPending ? 'Saving...' : 'Add Mod'}
            </button>
          </div>
        </form>
      )}

      {/* Mods list */}
      {isLoading ? (
        <p className="text-foreground-muted text-sm">Loading modifications...</p>
      ) : (mods?.length ?? 0) === 0 ? (
        <div className="text-center py-8">
          <p className="text-foreground-muted text-sm">No modifications yet.</p>
        </div>
      ) : (
        <div>
          {/* Installed section */}
          {installed.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-foreground-secondary mb-3" data-testid="installed-section">
                Installed ({installed.length})
              </h4>
              <div className="space-y-3">
                {installed.map((mod) => (
                  <ModRow key={mod.id} mod={mod} />
                ))}
              </div>
            </div>
          )}

          {/* Removed section */}
          {removed.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground-secondary mb-3" data-testid="removed-section">
                Removed / Replaced ({removed.length})
              </h4>
              <div className="space-y-3">
                {removed.map((mod) => (
                  <ModRow key={mod.id} mod={mod} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
