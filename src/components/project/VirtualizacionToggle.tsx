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
    ? { label: 'Virtualización', icon: MonitorPlay, className: 'bg-teal-100 text-teal-700 border-teal-200' }
    : value === false
    ? { label: 'No es virtualización', icon: X, className: 'bg-slate-100 text-slate-500 border-slate-200' }
    : { label: 'Sin clasificar', icon: HelpCircle, className: 'bg-gray-50 text-gray-400 border-dashed border-gray-300' };

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
        'flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors',
        config.className
      )}
    >
      <Icon className="h-3 w-3" /> {config.label}
    </button>
  );
}
