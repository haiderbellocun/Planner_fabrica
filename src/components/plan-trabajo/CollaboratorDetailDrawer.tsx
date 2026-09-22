import { ResponsiveLine } from '@nivo/line';
import { ResponsivePie } from '@nivo/pie';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useWorkPlanCollaboratorDetail } from '@/hooks/useWorkPlan';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';
import { formatNumber, formatPercent } from '@/lib/workPlanFormat';
import { Loader2 } from 'lucide-react';

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function CollaboratorDetailDrawer({
  collaboratorId,
  onOpenChange,
}: {
  collaboratorId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useWorkPlanCollaboratorDetail(collaboratorId);

  return (
    <Sheet open={!!collaboratorId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={data.profile.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold">{initials(data.profile.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle>{data.profile.full_name}</SheetTitle>
                  <p className="text-xs text-muted-foreground">{data.profile.cargo ?? '—'}{data.profile.team_name ? ` · ${data.profile.team_name}` : ''}</p>
                </div>
              </div>
            </SheetHeader>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: 'Asignadas', value: data.kpis.asignadas },
                { label: 'En proceso', value: data.kpis.en_proceso },
                { label: 'Completadas', value: data.kpis.completadas },
                { label: 'Vencidas', value: data.kpis.vencidas },
                { label: 'Avance', value: `${data.kpis.progress_pct}%` },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border bg-card px-2 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">{k.value}</p>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border p-3">
                <p className="text-xs font-semibold mb-2">Avance en el tiempo</p>
                <div style={{ height: 180 }}>
                  <ResponsiveLine
                    data={data.evolution}
                    margin={{ top: 10, right: 10, bottom: 30, left: 30 }}
                    xScale={{ type: 'point' }}
                    yScale={{ type: 'linear', min: 0, max: 'auto' }}
                    curve="monotoneX"
                    theme={nivoTheme}
                    colors={[nivoSeriesColors[0]]}
                    pointSize={5}
                    enableArea
                    areaOpacity={0.1}
                    useMesh
                    enableGridX={false}
                    axisBottom={{ tickSize: 0, tickPadding: 6 }}
                    axisLeft={{ tickSize: 0, tickPadding: 6 }}
                  />
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs font-semibold mb-2">Estado de sus tareas</p>
                <div style={{ height: 180 }}>
                  <ResponsivePie
                    data={data.status_distribution.filter(s => s.count > 0).map((s) => ({ id: s.name, label: s.name, value: s.count, color: s.color }))}
                    margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    innerRadius={0.6}
                    padAngle={1.5}
                    cornerRadius={3}
                    colors={{ datum: 'data.color' }}
                    theme={nivoTheme}
                    enableArcLinkLabels={false}
                    arcLabelsSkipAngle={20}
                    arcLabelsTextColor="#ffffff"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold mb-2">Tareas ({data.tasks.length})</p>
              <div className="rounded-xl border overflow-auto max-h-[360px]">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      {['Prioridad', 'Proyecto', 'Programa', 'Materia', 'Gránulo', 'Tarea', 'Estado', 'Sprint', 'Fecha límite', 'Actualizado'].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map((t) => (
                      <tr key={t.id} className="border-t border-border/60">
                        <td className="px-2 py-1.5"><Badge variant="outline" className="text-[10px] capitalize">{t.priority}</Badge></td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{t.project_name}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{t.programa_name ?? '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{t.materia_name ?? '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{t.granulo_name ?? '—'}</td>
                        <td className="px-2 py-1.5 max-w-[160px] truncate" title={t.title}>{t.title}</td>
                        <td className="px-2 py-1.5">
                          <span className="px-1.5 py-0.5 rounded text-white text-[10px]" style={{ backgroundColor: t.status_color }}>{t.status_name}</span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{t.sprint_name ?? '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{t.due_date ? new Date(t.due_date).toLocaleDateString('es-CO') : '—'}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{new Date(t.updated_at).toLocaleDateString('es-CO')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
