import { ResponsiveLine } from '@nivo/line';
import { useWorkPlanActivity } from '@/hooks/useWorkPlan';
import { ChartContainer } from './charts/ChartContainer';
import { nivoTheme, nivoSeriesColors } from '@/components/charts/nivoTheme';
import { formatRelativeDate } from '@/lib/workPlanFormat';

export function ActivityFeed() {
  const { data, isLoading } = useWorkPlanActivity();
  const hasSeries = (data?.daily ?? []).some((s) => s.data.some((p) => p.y > 0));

  return (
    <ChartContainer
      title="Actividad del equipo"
      subtitle={data ? `${data.last_24h} cambios en 24h · ${data.last_7d} en 7 días` : undefined}
      loading={isLoading}
      empty={!isLoading && !hasSeries && (data?.feed.length ?? 0) === 0}
      minHeight={320}
    >
      <div className="space-y-3">
        <div style={{ height: 100 }}>
          <ResponsiveLine
            data={data?.daily ?? []}
            margin={{ top: 8, right: 8, bottom: 20, left: 24 }}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 0, max: 'auto' }}
            curve="monotoneX"
            theme={nivoTheme}
            colors={[nivoSeriesColors[1]]}
            enableArea
            areaOpacity={0.1}
            pointSize={0}
            enableGridX={false}
            axisLeft={{ tickSize: 0, tickPadding: 4, tickValues: 3 }}
            axisBottom={{ tickSize: 0, tickPadding: 4, tickValues: 7 }}
            tooltip={({ point }) => (
              <div className="rounded-lg bg-white border shadow-md px-2.5 py-1.5 text-[11px]">
                {String(point.data.x)}: <b>{String(point.data.y)}</b> cambios
              </div>
            )}
          />
        </div>

        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
          {(data?.feed ?? []).slice(0, 12).map((item) => (
            <div key={item.id} className="text-xs flex items-start gap-2 border-b border-border/60 pb-1.5 last:border-0">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="truncate">
                  <b>{item.full_name}</b> cambió <span className="text-muted-foreground truncate">"{item.title}"</span>{' '}
                  {item.from_status ? `de ${item.from_status} a` : 'a'} <b>{item.to_status}</b>
                </p>
                <p className="text-[10px] text-muted-foreground">{formatRelativeDate(item.started_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartContainer>
  );
}
