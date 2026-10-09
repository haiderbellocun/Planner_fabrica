import { CheckCircle2, PauseCircle } from 'lucide-react';

// Shared status-badge lookup for Projects.tsx and ProjectDetail.tsx, so the
// two don't drift into slightly different labels/colors for the same status.
// 'active' and 'archived' render no badge (archived is an unused legacy value).
export const PROJECT_STATUS_BADGES = {
  paused: {
    label: 'Pausado',
    className: 'bg-warning/15 text-warning-strong border-warning/30',
    textClassName: 'text-warning-strong',
    icon: PauseCircle,
  },
  completed: {
    label: 'Finalizado',
    className: 'bg-success/10 text-success-strong border-success/30',
    textClassName: 'text-success-strong',
    icon: CheckCircle2,
  },
} as const;
