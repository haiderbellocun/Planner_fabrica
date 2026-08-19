import { CheckCircle2, PauseCircle } from 'lucide-react';

// Shared status-badge lookup for Projects.tsx and ProjectDetail.tsx, so the
// two don't drift into slightly different labels/colors for the same status.
// 'active' and 'archived' render no badge (archived is an unused legacy value).
export const PROJECT_STATUS_BADGES = {
  paused: {
    label: 'Pausado',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    textClassName: 'text-amber-700',
    icon: PauseCircle,
  },
  completed: {
    label: 'Finalizado',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    textClassName: 'text-emerald-700',
    icon: CheckCircle2,
  },
} as const;
