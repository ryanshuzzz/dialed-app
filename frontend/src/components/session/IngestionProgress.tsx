interface IngestionProgressProps {
  status: string;
  source: string;
  jobId: string;
}

export function IngestionProgress({ status, source, jobId: _jobId }: IngestionProgressProps) {
  const statusText: Record<string, string> = {
    pending: 'Waiting to process...',
    processing: 'Processing...',
    complete: 'Complete',
    failed: 'Failed',
  };

  const statusColor: Record<string, string> = {
    pending: 'text-yellow-600',
    processing: 'text-blue-600',
    complete: 'text-green-600',
    failed: 'text-red-600',
  };

  const isActive = status === 'pending' || status === 'processing';

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4"
      data-testid="ingestion-progress"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 capitalize">
          {source} Ingestion
        </span>
        <span className={`text-xs font-medium ${statusColor[status] ?? 'text-gray-500'}`}>
          {statusText[status] ?? status}
        </span>
      </div>
      {isActive && (
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
        </div>
      )}
      {status === 'complete' && (
        <div className="w-full h-1.5 bg-green-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full w-full" />
        </div>
      )}
      {status === 'failed' && (
        <div className="w-full h-1.5 bg-red-100 rounded-full overflow-hidden">
          <div className="h-full bg-red-500 rounded-full w-full" />
        </div>
      )}
    </div>
  );
}
