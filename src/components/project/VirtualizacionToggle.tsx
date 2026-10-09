import { MonitorPlay, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateProject } from '@/hooks/useProjects';

// Cicla sin clasificar -> es virtualización -> no es virtualización -> sin clasificar
function nextVirtualizacion(current: boolean | null): boolean | null {
  if (current === null) return true;
  if (current === true) return false;
  return null;
}

export function VirtualizacionToggle({ project }: { project: { id: string; es_virtualizacion: boolean | null } }) {
  const updateProject = useUpdateProject();
  const value = project.es_virtualizacion;

  const config = value === true
    ? { label: 'Virtualización', icon: MonitorPlay, className: 'bg-secondary text-primary-deep border-primary/40' }
    : value === false
    ? { label: 'No es virtualización', icon: X, className: 'bg-muted text-muted-foreground border-border' }
    : { label: 'Sin clasificar', icon: HelpCircle, className: 'bg-muted/50 text-muted-foreground border-dashed border-border' };

  const Icon = config.icon;

  return (
    <button
      type="button"
      title="Click para cambiar: sin clasificar → virtualización → no es virtualización"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        updateProject.mutate({ id: project.id, es_virtualizacion: nextVirtualizacion(value) });
      }}
      className={cn(
        'flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-full border transition-colors',
        config.className
      )}
    >
      <Icon className="h-3 w-3" /> {config.label}
    </button>
  );
}
