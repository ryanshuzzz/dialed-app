import type { Bike } from '@/api/types';

const STATUS_STYLES: Record<Bike['status'], { bg: string; text: string; label: string }> = {
  owned: { bg: 'bg-green-100', text: 'text-green-800', label: 'Owned' },
  sold: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Sold' },
  stored: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Stored' },
  in_repair: { bg: 'bg-red-100', text: 'text-red-800', label: 'In Repair' },
};

interface StatusBadgeProps {
  status: Bike['status'];
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} ${className}`}
      data-testid="status-badge"
    >
      {style.label}
    </span>
  );
}
