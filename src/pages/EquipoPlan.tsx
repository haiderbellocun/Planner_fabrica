import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEquipos } from '@/hooks/useEquipos';
import { useEquipoPlan, useAddEquipoPlanItem, useRemoveEquipoPlanItem } from '@/hooks/useEquipoPlan';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatTile, StatusPill } from '@/components/shared/StoryUI';
import { TaskPickerDialog } from '@/components/equipos/TaskPickerDialog';
import { parseDateOnly } from '@/lib/dates';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function EquipoPlanPage() {
  const { equipoId } = useParams<{ equipoId: string }>();
  const { isProjectLeader } = useAuth();
  const { data: equipos = [] } = useEquipos();
  const equipo = equipos.find((e) => e.id === equipoId);

  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekStart = format(anchorDate, 'yyyy-MM-dd');
  const weekEndDate = addDays(anchorDate, 6);

  const { data: plan, isLoading, isError, error } = useEquipoPlan(equipoId, weekStart);
  const addItem = useAddEquipoPlanItem(equipoId || '');
  const removeItem = useRemoveEquipoPlanItem(equipoId || '');

  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const allItems = plan?.sections.flatMap((s) => s.items) ?? [];
  const completedCount = allItems.filter((i) => i.task.status.is_completed).length;

  return (
    <div className="page-container">
      <Link to="/equipos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Volver a Equipos
      </Link>

      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: equipo?.color }} />
          <div>
            <h1 className="page-title">Plan semanal — {equipo?.name ?? 'Equipo'}</h1>
            <p className="page-description">Tareas planificadas por colaborador, enlazadas a Planner</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchorDate((d) => subWeeks(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium tabular-nums whitespace-nowrap">
            {format(anchorDate, 'd MMM', { locale: es })} – {format(weekEndDate, 'd MMM yyyy', { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setAnchorDate((d) => addWeeks(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchorDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Esta semana
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mb-3 text-coral" />
          <p className="text-sm">No se pudo cargar el plan semanal.</p>
          <p className="text-xs mt-1">{(error as Error)?.message || 'Error de conexión.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatTile label="Tareas planificadas" value={allItems.length} />
            <StatTile label="Completadas esta semana" value={`${completedCount}/${allItems.length}`} />
            <StatTile
              label="Avance"
              value={allItems.length > 0 ? `${Math.round((completedCount / allItems.length) * 100)}%` : '—'}
              pill={allItems.length > 0 && completedCount === allItems.length ? { tone: 'good', label: 'Completo' } : undefined}
            />
          </div>

          {plan && plan.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Este equipo no tiene miembros todavía.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {plan?.sections.map((section) => {
                const sectionCompleted = section.items.filter((i) => i.task.status.is_completed).length;
                return (
                  <Card key={section.profile_id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={section.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(section.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{section.full_name ?? 'Sin nombre'}</p>
                            {!section.is_current_member && (
                              <p className="text-[11px] text-muted-foreground">Ya no está en este equipo</p>
                            )}
                          </div>
                        </div>
                        {section.items.length > 0 && (
                          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            {sectionCompleted}/{section.items.length}
                          </span>
                        )}
                      </div>

                      {section.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">Sin tareas planificadas esta semana</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {section.items.map((item) => {
                            const dueDate = parseDateOnly(item.task.due_date);
                            return (
                              <li key={item.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm truncate">{item.task.title}</span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{item.task.project.key}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <StatusPill tone={item.task.status.is_completed ? 'good' : 'info'}>
                                      {item.task.status.name}
                                    </StatusPill>
                                    {dueDate && (
                                      <span className="text-[11px] text-muted-foreground">
                                        {format(dueDate, 'd MMM', { locale: es })}
                                      </span>
                                    )}
                                    <span className="text-[11px] text-muted-foreground/70">
                                      {item.added_by_name ? `Agregado por ${item.added_by_name}` : 'Agregado automático'}
                                    </span>
                                  </div>
                                </div>
                                {isProjectLeader && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => removeItem.mutate(item.id)}
                                    title="Quitar del plan"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {isProjectLeader && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setPickerFor(section.profile_id)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar tarea
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <TaskPickerDialog
        open={!!pickerFor}
        onOpenChange={(open) => !open && setPickerFor(null)}
        defaultAssigneeId={pickerFor ?? undefined}
        onSelectTask={(taskId) => {
          if (!pickerFor) return;
          addItem.mutate({ profile_id: pickerFor, task_id: taskId, week_start: weekStart });
        }}
      />
    </div>
  );
}
