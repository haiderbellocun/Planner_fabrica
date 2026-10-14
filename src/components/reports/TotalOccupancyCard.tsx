// «Ocupación total» de la fábrica: backlog pendiente (sin importar el vencimiento) de la población activa con cargo
// frente a UNA semana de su capacidad. Es la tarjeta principal de Capacidad y de Capacidad Operativa y las dos la
// pintan con este mismo componente y con el mismo objeto `TotalOccupancy` (lib/capacityMetrics → useFactoryOccupancy).
// No se clasifica con las bandas de ocupación semanal: puede superar 100 % y 200 % ≈ dos semanas de trabajo.
import { CHART_COLORS, formatHours } from '@/components/reports/ReportCharts';
import type { TotalOccupancy } from '@/lib/capacityMetrics';

export function formatTotalPct(pct: number): string {
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

export function TotalOccupancyCard({ total }: { total: TotalOccupancy }) {
  const hayCapacidad = total.capacidadSemanal > 0;
  // Teal = lo que cabe en una semana de capacidad; coral = lo que la excede (descriptivo, no un estado).
  // La barra abarca max(100 %, %). Teal = lo que cabe en una semana de capacidad; coral = lo que la excede
  // (descriptivo, no un estado ni una banda).
  const scale = Math.max(100, total.pct);
  const tealPct = hayCapacidad ? (Math.min(100, total.pct) / scale) * 100 : 0;
  const coralPct = hayCapacidad && total.pct > 100 ? ((total.pct - 100) / scale) * 100 : 0;
  const semanasTxt = `${total.semanas} ${total.semanas === 1 ? 'semana' : 'semanas'}`;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3" data-testid="ocupacion-total" aria-label="Ocupación total de la fábrica">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Ocupación total</p>
          <p className="figure text-4xl font-bold tabular-nums" data-testid="ocupacion-total-pct">
            {hayCapacidad ? formatTotalPct(total.pct) : '—'}
          </p>
        </div>
        {hayCapacidad && (
          <p className="mb-1 text-sm font-semibold tabular-nums" data-testid="ocupacion-total-semanas">≈ {semanasTxt} de trabajo</p>
        )}
        <p className="text-sm text-muted-foreground" data-testid="ocupacion-total-horas">
          {formatHours(total.horasActivas)} pendientes · {formatHours(total.capacidadSemanal)} de capacidad semanal de referencia
        </p>
      </div>

      {hayCapacidad ? (
        <div className="space-y-1">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div style={{ width: `${tealPct}%`, backgroundColor: CHART_COLORS.teal }} />
            <div style={{ width: `${coralPct}%`, backgroundColor: CHART_COLORS.coral }} />
          </div>
          {coralPct > 0 && (
            <p className="text-2xs" style={{ color: CHART_COLORS.coral }}>
              Supera en {formatTotalPct(Math.round((total.pct - 100) * 10) / 10)} la capacidad de una semana.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-warning-strong" data-testid="ocupacion-total-sin-capacidad">
          Sin capacidad semanal de referencia: no se puede calcular el porcentaje.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Es el backlog total (todas las horas pendientes, venzan cuando venzan) frente a una semana de capacidad del equipo activo:
        puede superar 100 %, y 200 % equivale a unas dos semanas de trabajo. No es la ocupación de la semana.
      </p>

      {total.tareasSinEstimar > 0 && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-strong" data-testid="ocupacion-total-sin-estimar">
          {total.tareasSinEstimar} {total.tareasSinEstimar === 1 ? 'tarea pendiente no tiene horas estimadas y no se cuenta' : 'tareas pendientes no tienen horas estimadas y no se cuentan'}:
          la ocupación total real podría ser mayor.
        </p>
      )}
      {total.fueraDeCapacidad > 0 && (
        <p className="text-2xs text-muted-foreground" data-testid="horas-fuera-capacidad">
          Además hay <b className="text-foreground">{formatHours(total.fueraDeCapacidad)}</b> pendientes de personas inactivas, sin cargo o sin
          responsable: no entran en este porcentaje porque no forman parte de la capacidad activa, pero siguen pendientes.
        </p>
      )}
    </section>
  );
}
