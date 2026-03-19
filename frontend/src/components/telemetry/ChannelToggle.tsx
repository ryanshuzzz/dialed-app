import type { ChannelInfo } from '@/api/types';

interface ChannelToggleProps {
  channels: ChannelInfo[];
  activeChannels: string[];
  onToggle: (channelName: string) => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  gps_speed: '#2563eb',
  throttle_pos: '#16a34a',
  rpm: '#dc2626',
  gear: '#7c3aed',
  lean_angle: '#ea580c',
  front_brake_psi: '#0891b2',
  rear_brake_psi: '#4f46e5',
  fork_position: '#ca8a04',
};

export function getChannelColor(name: string): string {
  return CHANNEL_COLORS[name] ?? '#6b7280';
}

export function ChannelToggle({ channels, activeChannels, onToggle }: ChannelToggleProps) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="channel-toggle">
      {channels.map((ch) => {
        const isActive = activeChannels.includes(ch.name);
        const color = getChannelColor(ch.name);
        return (
          <button
            key={ch.name}
            onClick={() => onToggle(ch.name)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              isActive
                ? 'text-white border-transparent'
                : 'text-gray-500 border-gray-300 bg-white hover:bg-gray-50'
            }`}
            style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
            data-testid={`channel-toggle-${ch.name}`}
          >
            {ch.name.replace(/_/g, ' ')}
          </button>
        );
      })}
    </div>
  );
}
