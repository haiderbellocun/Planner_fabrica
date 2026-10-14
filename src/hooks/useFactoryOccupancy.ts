// Fuente única de la «Ocupación total» de la fábrica para Reportes › Capacidad y Capacidad Operativa.
// Ambas pestañas la leen de aquí: mismas consultas SIN filtros de cargo/proyecto/período (misma clave de caché),
// misma población (personas activas con cargo) y la misma función de cálculo (lib/capacityMetrics.totalOccupancy).
import { useMemo } from 'react';
import { useReportCapacityForecast, useReportProjectUtilization } from '@/hooks/useReports';
import { totalOccupancy } from '@/lib/capacityMetrics';

export function useFactoryOccupancy() {
  const forecast = useReportCapacityForecast({ weeks: 4 });
  const utilization = useReportProjectUtilization();
  const members = forecast.data?.members;
  const horasPendientesFabrica = utilization.data?.summary.horas_pendientes_fabrica;
  const total = useMemo(
    () => (members ? totalOccupancy(members, horasPendientesFabrica) : null),
    [members, horasPendientesFabrica],
  );
  return {
    total,
    isLoading: forecast.isLoading,
    isError: forecast.isError && !forecast.data,
    error: forecast.error,
    refetch: forecast.refetch,
  };
}
