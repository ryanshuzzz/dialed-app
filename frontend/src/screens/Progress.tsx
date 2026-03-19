import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLapTrends, useEfficacy, useSessionHistory } from '@/hooks/useProgress';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

const TRACK_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
];

function formatLapTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`;
}

function formatDelta(ms: number): string {
  const sign = ms < 0 ? '-' : '+';
  return `${sign}${formatLapTime(Math.abs(ms))}`;
}

type SortKey = 'date' | 'best_lap_ms' | 'track_name';
type SortDir = 'asc' | 'desc';

export default function Progress() {
  const { data: progress, isLoading: progressLoading, isError: progressError, refetch: refetchProgress } = useLapTrends();
  const { data: efficacy, isLoading: efficacyLoading } = useEfficacy();
  const { data: history, isLoading: historyLoading } = useSessionHistory();

  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Build chart data: one entry per session, each track as its own series
  const { chartData, tracks } = useMemo(() => {
    const trend = progress?.lap_time_trend ?? [];
    const trackSet = [...new Set(trend.map((t) => t.track_name))];
    const data = trend.map((item) => {
      const entry: Record<string, unknown> = {
        date: item.date,
        session_id: item.session_id,
      };
      // Only populate the track key that matches this item
      for (const track of trackSet) {
        entry[track] = item.track_name === track ? item.best_lap_ms : undefined;
      }
      return entry;
    });
    return { chartData: data, tracks: trackSet };
  }, [progress]);

  // Session history with sorting and filtering
  const filteredSessions = useMemo(() => {
    let sessions = history?.sessions ?? [];
    if (trackFilter !== 'all') {
      sessions = sessions.filter((s) => s.track_name === trackFilter);
    }
    const sorted = [...sessions].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortKey === 'best_lap_ms') {
        cmp = (a.best_lap_ms ?? Infinity) - (b.best_lap_ms ?? Infinity);
      } else if (sortKey === 'track_name') {
        cmp = a.track_name.localeCompare(b.track_name);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [history, trackFilter, sortKey, sortDir]);

  const historyTracks = useMemo(() => {
    return [...new Set((history?.sessions ?? []).map((s) => s.track_name))];
  }, [history]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const isLoading = progressLoading || efficacyLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">Progress</h2>
        <LoadingSkeleton variant="lines" count={3} />
        <LoadingSkeleton variant="cards" count={3} />
        <LoadingSkeleton variant="table" count={4} />
      </div>
    );
  }

  if (progressError) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">Progress</h2>
        <ErrorState message="Failed to load progress data." onRetry={() => refetchProgress()} />
      </div>
    );
  }

  const hasData = (progress?.lap_time_trend?.length ?? 0) > 0 || (history?.sessions?.length ?? 0) > 0;

  if (!hasData) {
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold">Progress</h2>
        <EmptyState
          title="No progress data yet"
          description="Complete some track sessions to see your lap time trends and improvement."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Progress</h2>

      {/* Lap Time Trend Chart */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Lap Time Trends</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-2 sm:p-4" data-testid="lap-trend-chart">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis
                tickFormatter={(v: number) => formatLapTime(v)}
                domain={['auto', 'auto']}
                reversed
              />
              <Tooltip
                formatter={(value: unknown) => formatLapTime(Number(value))}
                labelFormatter={(label: unknown) => `Date: ${String(label)}`}
              />
              <Legend />
              {tracks.map((track, i) => (
                <Line
                  key={track}
                  type="monotone"
                  dataKey={track}
                  stroke={TRACK_COLORS[i % TRACK_COLORS.length]}
                  connectNulls
                  dot
                  name={track}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Best Laps by Track + Total Time Found */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {progress?.best_laps_by_track?.map((best) => (
            <div
              key={best.track_id}
              className="bg-white rounded-lg border border-gray-200 p-4"
              data-testid="best-lap-card"
            >
              <h4 className="font-semibold text-gray-900">{best.track_name}</h4>
              <p className="text-2xl font-bold text-blue-800 mt-1">
                {formatLapTime(best.best_lap_ms)}
              </p>
              <p className="text-sm text-gray-500 mt-1">{best.date}</p>
            </div>
          ))}
          {progress?.total_time_found_ms != null && (
            <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="total-time-found">
              <h4 className="font-semibold text-gray-900">Total Time Found</h4>
              <p className="text-2xl font-bold text-green-700 mt-1">
                {formatLapTime(progress.total_time_found_ms)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Cumulative improvement</p>
            </div>
          )}
        </div>
      </section>

      {/* Efficacy Dashboard */}
      <section>
        <h3 className="text-lg font-semibold mb-3">Efficacy Dashboard</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-testid="efficacy-dashboard">
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500">Adoption Rate</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-800" data-testid="adoption-rate">
              {efficacy?.adoption_rate != null ? `${Math.round(efficacy.adoption_rate * 100)}%` : 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500">Avg Delta (Applied)</p>
            <p className="text-xl sm:text-2xl font-bold text-green-700" data-testid="delta-applied">
              {efficacy?.avg_delta_by_status?.applied != null
                ? formatDelta(efficacy.avg_delta_by_status.applied)
                : 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500">Avg Delta (Modified)</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600" data-testid="delta-modified">
              {efficacy?.avg_delta_by_status?.applied_modified != null
                ? formatDelta(efficacy.avg_delta_by_status.applied_modified)
                : 'N/A'}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500">Avg Delta (Skipped)</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600" data-testid="delta-skipped">
              {efficacy?.avg_delta_by_status?.skipped != null
                ? formatDelta(efficacy.avg_delta_by_status.skipped)
                : 'N/A'}
            </p>
          </div>
        </div>
      </section>

      {/* Session History Table */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
          <h3 className="text-lg font-semibold">Session History</h3>
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 min-h-[44px] text-sm self-start sm:self-auto"
            data-testid="track-filter"
          >
            <option value="all">All Tracks</option>
            {historyTracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm" data-testid="session-history-table">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th
                  className="px-3 sm:px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none min-h-[44px]"
                  onClick={() => handleSort('date')}
                >
                  Date {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th
                  className="px-3 sm:px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none min-h-[44px]"
                  onClick={() => handleSort('track_name')}
                >
                  Track {sortKey === 'track_name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">Type</th>
                <th
                  className="px-3 sm:px-4 py-3 text-left font-medium text-gray-600 cursor-pointer select-none min-h-[44px]"
                  onClick={() => handleSort('best_lap_ms')}
                >
                  Best Lap {sortKey === 'best_lap_ms' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="px-3 sm:px-4 py-3 text-left font-medium text-gray-600">Delta</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr key={session.session_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3">{session.date}</td>
                  <td className="px-3 sm:px-4 py-3">{session.track_name}</td>
                  <td className="px-3 sm:px-4 py-3 capitalize hidden sm:table-cell">{session.session_type}</td>
                  <td className="px-3 sm:px-4 py-3">
                    {session.best_lap_ms != null ? formatLapTime(session.best_lap_ms) : '-'}
                  </td>
                  <td className="px-3 sm:px-4 py-3">
                    {session.delta_from_previous_ms != null ? (
                      <span
                        className={
                          session.delta_from_previous_ms < 0
                            ? 'text-green-700'
                            : 'text-red-600'
                        }
                      >
                        {formatDelta(session.delta_from_previous_ms)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
              {filteredSessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No sessions match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
