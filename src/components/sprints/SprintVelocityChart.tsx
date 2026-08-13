import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { CustomTooltip } from '@/components/charts/CustomTooltip';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, BAR_RADIUS } from '@/components/reports/ReportCharts';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { Sprint } from '@/hooks/useSprints';

interface SprintVelocityChartProps {
  sprints: Sprint[];
}

export function SprintVelocityChart({ sprints }: SprintVelocityChartProps) {
  const completed = sprints
    .filter((s) => s.status === 'completed')
    .sort((a, b) => (a.end_date ?? a.completed_at ?? '').localeCompare(b.end_date ?? b.completed_at ?? ''))
    .map((s) => ({ name: s.name, completed: s.completed_count ?? 0 }));

  if (completed.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aún no hay sprints completados para calcular la velocidad.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Velocidad</CardTitle>
        <CardDescription>Tareas completadas por sprint</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={{ completed: { label: 'Completadas', color: CHART_COLORS.teal } }} className="h-[260px] w-full">
          <BarChart data={completed} margin={{ left: 10, right: 10, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} />
            <XAxis dataKey="name" {...AXIS_STYLE} tick={{ fontSize: 10 }} interval={0} />
            <YAxis {...AXIS_STYLE} allowDecimals={false} />
            <ChartTooltip content={<CustomTooltip />} />
            <Bar dataKey="completed" fill={CHART_COLORS.teal} radius={BAR_RADIUS} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
