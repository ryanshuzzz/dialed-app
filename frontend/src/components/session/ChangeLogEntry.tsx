import type { ChangeLog } from '@/api/types';

interface ChangeLogEntryProps {
  change: ChangeLog;
}

export function ChangeLogEntry({ change }: ChangeLogEntryProps) {
  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-b-0"
      data-testid="change-log-entry"
    >
      <div className="flex-shrink-0 mt-1 w-2 h-2 rounded-full bg-blue-500" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">
            {change.parameter.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-gray-400">
            {change.from_value != null && (
              <>
                <span className="text-red-500">{change.from_value}</span>
                {' \u2192 '}
              </>
            )}
            <span className="text-green-600 font-medium">{change.to_value}</span>
          </span>
        </div>
        {change.rationale && (
          <p className="text-xs text-gray-500 mt-1">{change.rationale}</p>
        )}
        <time className="text-xs text-gray-300 mt-1 block">
          {new Date(change.applied_at).toLocaleTimeString()}
        </time>
      </div>
    </div>
  );
}
