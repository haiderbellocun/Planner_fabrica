import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { CreateTeamDialog } from './CreateTeamDialog';
import { useTeams, useDeleteTeam } from '@/hooks/useTeams';
import type { Team, ProjectMember, Profile } from '@/types/database';
import { TaskWithDetails } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

const priorityConfig = {
  low: { label: 'Baja', className: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Media', className: 'bg-amber-100 text-amber-700' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700' },
};

interface TeamsPanelProps {
  projectId: string;
  canManage: boolean;
  members: (ProjectMember & { profile: Profile })[];
  tasks?: TaskWithDetails[];
  onTaskClick?: (task: TaskWithDetails) => void;
}

export function TeamsPanel({ projectId, canManage, members, tasks = [], onTaskClick }: TeamsPanelProps) {
  const { data: teams = [], isLoading } = useTeams(projectId);
  const deleteTeam = useDeleteTeam(projectId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const sortedTeams = useMemo(
    () =>
      [...teams].sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }),
    [teams]
  );

  const handleCreate = () => {
    setSelectedTeam(null);
    setDialogOpen(true);
  };

  const handleEdit = (team: Team) => {
    setSelectedTeam(team);
    setDialogOpen(true);
  };

  const handleDelete = (team: Team) => {
    if (!confirm(`¿Eliminar el equipo "${team.name}"? Las tareas quedarán sin equipo.`)) return;
    deleteTeam.mutate(team.id);
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo equipo
          </Button>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Cargando equipos...</CardContent>
        </Card>
      ) : sortedTeams.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay equipos creados en este proyecto.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sortedTeams.map((team) => {
            const teamTasks = tasks.filter((t) => (t as any).team_id === team.id);
            const isExpanded = expandedTeamId === team.id;

            return (
              <Card key={team.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div style={{ borderLeft: `4px solid ${team.color}` }}>
                    {/* Team header — click to expand */}
                    <div
                      className="flex items-start gap-2 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                    >
                      <div className="mt-0.5 text-muted-foreground">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{team.name}</h4>
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            {teamTasks.length} {teamTasks.length === 1 ? 'tarea' : 'tareas'}
                          </span>
                        </div>
                        {team.members.length > 0 ? (
                          <div className="flex items-center -space-x-2">
                            {team.members.slice(0, 6).map((m) => (
                              <div
                                key={m.id}
                                className="h-6 w-6 rounded-full ring-2 ring-white bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary overflow-hidden"
                                title={m.full_name ?? ''}
                              >
                                {m.avatar_url
                                  ? <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                                  : (m.full_name?.charAt(0) ?? '?')}
                              </div>
                            ))}
                            {team.members.length > 6 && (
                              <div className="h-6 w-6 rounded-full ring-2 ring-white bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                                +{team.members.length - 6}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sin miembros asignados</p>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(team)}
                            title="Editar equipo"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(team)}
                            title="Eliminar equipo"
                            disabled={deleteTeam.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Task list — visible when expanded */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20">
                        {teamTasks.length === 0 ? (
                          <p className="text-sm text-muted-foreground px-10 py-4">
                            No hay tareas asignadas a este equipo.
                          </p>
                        ) : (
                          <div className="divide-y">
                            {teamTasks.map((task) => (
                              <div
                                key={task.id}
                                className="flex items-center gap-3 px-10 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={(e) => { e.stopPropagation(); onTaskClick?.(task); }}
                              >
                                <span
                                  className="h-2 w-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: task.status?.color || '#94a3b8' }}
                                />
                                <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
                                <Badge
                                  className={cn('text-xs flex-shrink-0', priorityConfig[task.priority].className)}
                                >
                                  {priorityConfig[task.priority].label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: `${task.status?.color}15`,
                                    color: task.status?.color,
                                    borderColor: task.status?.color,
                                  }}
                                >
                                  {task.status?.name}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateTeamDialog
        projectId={projectId}
        team={selectedTeam}
        members={members}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedTeam(null);
        }}
      />
    </div>
  );
}
