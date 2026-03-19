import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TelemetryPoint } from '@/api/types';
import { getChannelColor } from './ChannelToggle';

interface TelemetryChartProps {
  points: TelemetryPoint[];
  activeChannels: string[];
}

export function TelemetryChart({ points, activeChannels }: TelemetryChartProps) {
  if (points.length === 0 || activeChannels.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200" data-testid="telemetry-chart-empty">
        <p className="text-sm text-gray-400">
          {points.length === 0
            ? 'No telemetry data available.'
            : 'Select at least one channel to display.'}
        </p>
      </div>
    );
  }

  // Transform points into chart data with index-based x-axis
  const data = points.map((p, idx) => {
    const row: Record<string, number | null> = { index: idx };
    for (const ch of activeChannels) {
      row[ch] = (p as unknown as Record<string, number | null>)[ch] ?? null;
    }
    return row;
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="telemetry-chart">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 10 }}
            label={{ value: 'Sample', position: 'insideBottom', offset: -5, fontSize: 11 }}
          />
          {activeChannels.map((ch, i) => (
            <YAxis
              key={ch}
              yAxisId={ch}
              orientation={i % 2 === 0 ? 'left' : 'right'}
              tick={{ fontSize: 10 }}
              width={50}
              hide={i >= 2}
            />
          ))}
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            labelFormatter={(val) => `Sample ${val}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {activeChannels.map((ch) => (
            <Line
              key={ch}
              yAxisId={ch}
              type="monotone"
              dataKey={ch}
              stroke={getChannelColor(ch)}
              dot={false}
              strokeWidth={1.5}
              name={ch.replace(/_/g, ' ')}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
