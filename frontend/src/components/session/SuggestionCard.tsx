import { useState } from 'react';
import type { SuggestionChange } from '@/api/types';

interface SuggestionCardProps {
  change: SuggestionChange;
  onApply: (changeId: string) => void;
  onSkip: (changeId: string) => void;
  onModify: (changeId: string, actualValue: string) => void;
}

export function SuggestionCard({ change, onApply, onSkip, onModify }: SuggestionCardProps) {
  const [showModify, setShowModify] = useState(false);
  const [actualValue, setActualValue] = useState('');

  const isActioned = change.applied_status !== 'not_applied';

  const statusColors: Record<string, string> = {
    not_applied: 'bg-gray-100 text-gray-600',
    applied: 'bg-green-100 text-green-700',
    applied_modified: 'bg-yellow-100 text-yellow-700',
    skipped: 'bg-red-100 text-red-700',
  };

  return (
    <div
      className="rounded-lg border border-gray-200 p-4 bg-white"
      data-testid="suggestion-card"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            {change.parameter.replace(/_/g, ' ')}
          </h4>
          <p className="text-sm text-blue-600 font-medium mt-0.5">
            Suggested: {change.suggested_value}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[change.applied_status]}`}
        >
          {change.applied_status.replace(/_/g, ' ')}
        </span>
      </div>

      {change.symptom && (
        <p className="text-xs text-gray-500 mb-2">{change.symptom}</p>
      )}

      {change.confidence != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Confidence</span>
            <span>{Math.round(change.confidence * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${change.confidence * 100}%` }}
              data-testid="confidence-bar"
            />
          </div>
        </div>
      )}

      {change.actual_value && (
        <p className="text-xs text-gray-500 mb-2">
          Actual value applied: <span className="font-medium">{change.actual_value}</span>
        </p>
      )}

      {!isActioned && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onApply(change.id)}
            className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            data-testid="apply-button"
          >
            Apply
          </button>
          <button
            onClick={() => onSkip(change.id)}
            className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            data-testid="skip-button"
          >
            Skip
          </button>
          <button
            onClick={() => setShowModify(!showModify)}
            className="px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
            data-testid="modify-button"
          >
            Modify
          </button>
        </div>
      )}

      {showModify && !isActioned && (
        <div className="mt-3 flex items-center gap-2" data-testid="modify-input-section">
          <input
            type="text"
            value={actualValue}
            onChange={(e) => setActualValue(e.target.value)}
            placeholder="Actual value"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            data-testid="modify-input"
          />
          <button
            onClick={() => {
              if (actualValue.trim()) {
                onModify(change.id, actualValue.trim());
                setShowModify(false);
                setActualValue('');
              }
            }}
            className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            data-testid="modify-confirm"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}
