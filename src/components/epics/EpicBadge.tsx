import { Epic } from '@/hooks/useEpics';
import { cn } from '@/lib/utils';

interface EpicBadgeProps {
  epic: Pick<Epic, 'title' | 'color'>;
  className?: string;
}

export function EpicBadge({ epic, className }: EpicBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full truncate max-w-[120px]',
        className
      )}
      style={{ backgroundColor: `${epic.color}20`, color: epic.color, border: `1px solid ${epic.color}40` }}
      title={epic.title}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: epic.color }} />
      {epic.title}
    </span>
  );
}
