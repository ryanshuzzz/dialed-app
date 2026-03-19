import type { Modification } from '@/api/types';

const CATEGORY_COLORS: Record<string, string> = {
  exhaust: 'bg-orange-100 text-orange-800',
  suspension: 'bg-purple-100 text-purple-800',
  bodywork: 'bg-blue-100 text-blue-800',
  controls: 'bg-green-100 text-green-800',
  electronics: 'bg-yellow-100 text-yellow-800',
  engine: 'bg-red-100 text-red-800',
  brakes: 'bg-pink-100 text-pink-800',
  wheels: 'bg-indigo-100 text-indigo-800',
};

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatAction(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

interface ModRowProps {
  mod: Modification;
}

export function ModRow({ mod }: ModRowProps) {
  const badgeColor = CATEGORY_COLORS[mod.category] ?? 'bg-slate-100 text-slate-800';
  const isRemoved = mod.removed_at !== null;

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${isRemoved ? 'opacity-70' : ''}`}
      data-testid="mod-row"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}
              data-testid="mod-category-badge"
            >
              {formatCategory(mod.category)}
            </span>
            <span className="text-xs text-gray-400">
              {formatAction(mod.action)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">{mod.part_name}</p>
          {mod.brand && (
            <p className="text-xs text-gray-500">{mod.brand}</p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
            <span>
              Installed: {new Date(mod.installed_at).toLocaleDateString()}
            </span>
            {isRemoved && mod.removed_at && (
              <span>
                Removed: {new Date(mod.removed_at).toLocaleDateString()}
              </span>
            )}
            {mod.cost != null && (
              <span>
                {mod.currency ?? '$'}{mod.cost.toFixed(2)}
              </span>
            )}
          </div>
          {mod.notes && (
            <p className="text-xs text-gray-400 mt-1">{mod.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}
