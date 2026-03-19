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
import type { TirePressureLog } from '@/api/types';

interface TirePressureChartProps {
  readings: TirePressureLog[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TirePressureChart({ readings }: TirePressureChartProps) {
  if (readings.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center" data-testid="tire-pressure-chart">
        <p className="text-sm text-gray-500">No tire pressure data to display.</p>
      </div>
    );
  }

  const sorted = [...readings].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  const data = sorted.map((r) => ({
    date: formatDate(r.recorded_at),
    recorded_at: r.recorded_at,
    front_psi: r.front_psi,
    rear_psi: r.rear_psi,
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="tire-pressure-chart">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Pressure History</h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} unit=" psi" />
          <Tooltip
            formatter={(value, name) => [
              `${value} psi`,
              name === 'front_psi' ? 'Front' : 'Rear',
            ]}
          />
          <Legend
            formatter={(value: string) => (value === 'front_psi' ? 'Front PSI' : 'Rear PSI')}
          />
          <Line
            type="monotone"
            dataKey="front_psi"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="rear_psi"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
