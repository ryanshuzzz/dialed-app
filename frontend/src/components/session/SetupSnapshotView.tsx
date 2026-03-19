import type { SetupSnapshot } from '@/api/types';
import { SuspensionSpecCard } from '@/components/garage/SuspensionSpecCard';

interface SetupSnapshotViewProps {
  snapshots: SetupSnapshot[];
}

export function SetupSnapshotView({ snapshots }: SetupSnapshotViewProps) {
  if (snapshots.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200" data-testid="setup-snapshot-empty">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Setup Snapshot</h3>
        <p className="text-sm text-gray-400">No setup snapshot recorded for this session.</p>
      </div>
    );
  }

  const latest = snapshots[snapshots.length - 1];

  return (
    <div data-testid="setup-snapshot-view">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Setup Snapshot</h3>
        <span className="text-xs text-gray-400">
          {new Date(latest.created_at).toLocaleString()}
        </span>
      </div>
      <SuspensionSpecCard spec={latest.settings} />
    </div>
  );
}
