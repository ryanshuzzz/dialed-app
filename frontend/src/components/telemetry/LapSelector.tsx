interface LapSelectorProps {
  totalLaps: number;
  selectedLap: number;
  onSelect: (lap: number) => void;
}

export function LapSelector({ totalLaps, selectedLap, onSelect }: LapSelectorProps) {
  const laps = Array.from({ length: totalLaps }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-2" data-testid="lap-selector">
      <label className="text-sm font-medium text-gray-700">Lap:</label>
      <div className="flex gap-1 flex-wrap">
        {laps.map((lap) => (
          <button
            key={lap}
            onClick={() => onSelect(lap)}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
              lap === selectedLap
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`lap-button-${lap}`}
          >
            {lap}
          </button>
        ))}
      </div>
    </div>
  );
}
