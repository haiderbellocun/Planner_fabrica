import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { CustomTooltip } from '@/components/charts/CustomTooltip';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE } from '@/components/reports/ReportCharts';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useSprintBurndown, type Sprint } from '@/hooks/useSprints';

interface SprintBurndownChartProps {
  projectId: string;
  sprint: Sprint;
}

export function SprintBurndownChart({ projectId, sprint }: SprintBurndownChartProps) {
  const { data, isLoading } = useSprintBurndown(projectId, sprint.id);

  if (!sprint.start_date) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Este sprint aún no tiene fecha de inicio. Define una para ver el burndown.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Cargando burndown...</CardContent>
      </Card>
    );
  }

  const days = data?.days ?? [];

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          El sprint aún no ha comenzado.
        </CardContent>
      </Card>
    );
  }

  if (days.every((d) => d.total === 0)) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Este sprint no tiene tareas asignadas.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Burndown — {sprint.name}</CardTitle>
        <CardDescription>
          Tareas restantes por día{data?.meta.truncated ? ' (rango limitado a 365 días)' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            remaining: { label: 'Restantes', color: CHART_COLORS.coral },
            ideal: { label: 'Ideal', color: CHART_COLORS.muted },
          }}
          className="h-[280px] w-full"
        >
          <LineChart data={days} margin={{ left: 10, right: 10, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} />
            <XAxis
              dataKey="date"
              {...AXIS_STYLE}
              tickFormatter={(v) => new Date(v + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              tick={{ fontSize: 10 }}
            />
            <YAxis {...AXIS_STYLE} allowDecimals={false} />
            <ChartTooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="remaining" stroke={CHART_COLORS.coral} strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="ideal" stroke={CHART_COLORS.muted} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
