interface LoadingSkeletonProps {
  variant?: 'lines' | 'cards' | 'table';
  count?: number;
}

function SkeletonLine({ width = 'w-full' }: { width?: string }) {
  return <div className={`h-4 ${width} bg-gray-200 rounded animate-pulse`} />;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="h-5 w-2/3 bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
      <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <tr>
      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
    </tr>
  );
}

export function LoadingSkeleton({ variant = 'lines', count = 3 }: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'cards') {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="loading-skeleton"
      >
        {items.map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" data-testid="loading-skeleton">
        <table className="w-full">
          <tbody>
            {items.map((i) => (
              <SkeletonTableRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Default: lines
  return (
    <div className="space-y-3" data-testid="loading-skeleton">
      {items.map((i) => (
        <SkeletonLine key={i} width={i === items.length - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}
