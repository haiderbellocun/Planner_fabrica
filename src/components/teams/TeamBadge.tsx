import type { Team } from '@/types/database';
import { cn } from '@/lib/utils';

interface TeamBadgeProps {
  team: Pick<Team, 'name' | 'color'>;
  className?: string;
}

export function TeamBadge({ team, className }: TeamBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full truncate max-w-[120px]',
        className
      )}
      style={{ backgroundColor: `${team.color}20`, color: team.color, border: `1px solid ${team.color}40` }}
      title={team.name}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />
      {team.name}
    </span>
  );
}
