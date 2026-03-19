import type { SuspensionSpec, SuspensionEndSettings } from '@/api/types';

interface SuspensionSpecCardProps {
  spec: SuspensionSpec;
}

const LABELS: Record<keyof SuspensionEndSettings, string> = {
  compression: 'Compression',
  rebound: 'Rebound',
  preload: 'Preload',
  spring_rate: 'Spring Rate',
  oil_level: 'Oil Level',
  ride_height: 'Ride Height',
};

function EndSection({ title, settings }: { title: string; settings?: SuspensionEndSettings }) {
  if (!settings) return null;

  const entries = Object.entries(settings).filter(
    ([, value]) => value != null,
  ) as [keyof SuspensionEndSettings, number][];

  if (entries.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between col-span-1">
            <dt className="text-sm text-gray-500">{LABELS[key]}</dt>
            <dd className="text-sm font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SuspensionSpecCard({ spec }: SuspensionSpecCardProps) {
  const hasFront = spec.front && Object.values(spec.front).some((v) => v != null);
  const hasRear = spec.rear && Object.values(spec.rear).some((v) => v != null);

  if (!hasFront && !hasRear) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200" data-testid="suspension-spec-card">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Suspension</h3>
        <p className="text-sm text-gray-400">No suspension data recorded.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4" data-testid="suspension-spec-card">
      <h3 className="text-sm font-semibold text-gray-700">Suspension</h3>
      {hasFront && <EndSection title="Front" settings={spec.front} />}
      {hasRear && <EndSection title="Rear" settings={spec.rear} />}
    </div>
  );
}
