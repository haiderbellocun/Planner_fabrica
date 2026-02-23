import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMaterialTypes } from '@/hooks/useMateriales';
import { useTiemposEstimados } from '@/hooks/useTiemposEstimados';
import type { TiempoEstimado } from '@/hooks/useTiemposEstimados';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Calculator, CalendarDays, Users, Clock, BookOpen, Package, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Work schedule constants (same as backend)
const MON_THU_HOURS = 8.25;
const FRIDAY_HOURS = 7.25;
const WEEKLY_HOURS = MON_THU_HOURS * 4 + FRIDAY_HOURS; // 40.25
const AVG_DAILY_HOURS = WEEKLY_HOURS / 5; // 8.05

const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)]';

/**
 * Compute "total person-hours per unit" for each material type.
 * Strategy: for each material_type, group tiempos by cargo,
 * take the minimum cantidad_valor entry per cargo (base rate),
 * then sum across cargos.
 */
function computeHoursPerUnit(tiempos: TiempoEstimado[]) {
  const byMaterial: Record<string, TiempoEstimado[]> = {};

  for (const t of tiempos) {
    if (!t.material_type_id) continue;
    if (!byMaterial[t.material_type_id]) byMaterial[t.material_type_id] = [];
    byMaterial[t.material_type_id].push(t);
  }

  const result: Record<string, { hours: number; cargos: { cargo: string; horas: number }[] }> = {};

  for (const [mtId, entries] of Object.entries(byMaterial)) {
    // Group by cargo and take the entry with the smallest cantidad_valor per cargo
    const byCargo: Record<string, { horas: number; cantidadValor: number }> = {};

    for (const e of entries) {
      const existing = byCargo[e.cargo];
      if (!existing || e.cantidad_valor < existing.cantidadValor) {
        byCargo[e.cargo] = { horas: e.horas, cantidadValor: e.cantidad_valor };
      }
    }

    const cargos = Object.entries(byCargo).map(([cargo, data]) => ({
      cargo,
      horas: data.horas,
    }));

    const totalHours = cargos.reduce((sum, c) => sum + c.horas, 0);
    result[mtId] = { hours: totalHours, cargos };
  }

  return result;
}

/** Add business days to a date (skip Sat/Sun) */
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let remaining = Math.ceil(days);
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProjectCalculator() {
  const { isAdmin, isProjectLeader } = useAuth();

  // Role guard: only admin and project_leader
  if (!isAdmin && !isProjectLeader) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: materialTypes = [], isLoading: loadingMT } = useMaterialTypes();
  const { data: tiempos = [], isLoading: loadingTiempos } = useTiemposEstimados();

  const [numSubjects, setNumSubjects] = useState(5);
  const [teamSize, setTeamSize] = useState(3);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [overrideHours, setOverrideHours] = useState<Record<string, number | null>>({});

  // Compute base hours per unit per material type from tiempos_estimados
  const hoursMap = useMemo(() => computeHoursPerUnit(tiempos), [tiempos]);

  // Calculate results
  const results = useMemo(() => {
    let totalMaterials = 0;
    let totalPersonHours = 0;
    let materialsWithEstimation = 0;
    let materialsWithoutEstimation = 0;

    const rows = materialTypes.map(mt => {
      const qty = quantities[mt.id] || 0;
      const totalQty = qty * numSubjects;
      const baseHours = hoursMap[mt.id]?.hours || 0;
      const effectiveHours = overrideHours[mt.id] != null ? overrideHours[mt.id]! : baseHours;
      const subtotalHours = totalQty * effectiveHours;

      totalMaterials += totalQty;
      totalPersonHours += subtotalHours;

      if (qty > 0) {
        if (effectiveHours > 0) materialsWithEstimation++;
        else materialsWithoutEstimation++;
      }

      return {
        id: mt.id,
        name: mt.name,
        icon: mt.icon,
        qty,
        totalQty,
        baseHours,
        effectiveHours,
        subtotalHours,
        cargos: hoursMap[mt.id]?.cargos || [],
        hasEstimation: baseHours > 0,
      };
    });

    const effectiveTeam = Math.max(1, teamSize);
    const hoursPerPerson = totalPersonHours / effectiveTeam;
    const workDaysPerPerson = hoursPerPerson / AVG_DAILY_HOURS;
    const calendarWeeks = workDaysPerPerson / 5;
    const completionDate = workDaysPerPerson > 0
      ? addBusinessDays(new Date(), Math.ceil(workDaysPerPerson))
      : null;

    return {
      rows,
      totalMaterials,
      totalPersonHours: Math.round(totalPersonHours * 10) / 10,
      hoursPerPerson: Math.round(hoursPerPerson * 10) / 10,
      workDaysPerPerson: Math.round(workDaysPerPerson * 10) / 10,
      calendarWeeks: Math.round(calendarWeeks * 10) / 10,
      completionDate,
      materialsWithEstimation,
      materialsWithoutEstimation,
    };
  }, [materialTypes, quantities, numSubjects, teamSize, hoursMap, overrideHours]);

  if (loadingMT || loadingTiempos) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Calculadora de Proyectos
        </h1>
        <p className="page-description">
          Estima la duración de un proyecto según las asignaturas, materiales y equipo disponible
        </p>
      </div>

      <div className="space-y-6">
        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={CARD_CLASS}>
            <CardContent className="pt-5 space-y-2">
              <Label htmlFor="subjects" className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                Asignaturas
              </Label>
              <Input
                id="subjects"
                type="number"
                min={1}
                max={100}
                value={numSubjects}
                onChange={e => setNumSubjects(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">Número total de asignaturas del proyecto</p>
            </CardContent>
          </Card>

          <Card className={CARD_CLASS}>
            <CardContent className="pt-5 space-y-2">
              <Label htmlFor="team" className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-teal-500" />
                Equipo Disponible
              </Label>
              <Input
                id="team"
                type="number"
                min={1}
                max={50}
                value={teamSize}
                onChange={e => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">Personas trabajando en paralelo</p>
            </CardContent>
          </Card>

          <Card className={`${CARD_CLASS} border-teal-200 bg-teal-50/50`}>
            <CardContent className="pt-5 space-y-1.5">
              <p className="text-xs font-medium text-teal-900 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Jornada Laboral
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-teal-700">
                <span>Lun-Jue:</span><span className="font-medium">{MON_THU_HOURS}h/día</span>
                <span>Viernes:</span><span className="font-medium">{FRIDAY_HOURS}h/día</span>
                <span>Semanal:</span><span className="font-semibold">{WEEKLY_HOURS}h</span>
                <span>Promedio:</span><span className="font-medium">{Math.round(AVG_DAILY_HOURS * 100) / 100}h/día</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Materials per subject */}
        <Card className={CARD_CLASS}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Materiales por Asignatura
            </CardTitle>
            <CardDescription>
              Define la cantidad de cada tipo de material por asignatura. Las horas se calculan automáticamente desde los tiempos estimados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2.5 px-2 font-medium w-[200px]">Material</th>
                    <th className="text-center py-2.5 px-2 font-medium w-[100px]">Cant/Asig.</th>
                    <th className="text-center py-2.5 px-2 font-medium w-[100px]">Total</th>
                    <th className="text-center py-2.5 px-2 font-medium w-[120px]">
                      <span className="flex items-center justify-center gap-1">
                        Hrs/Unid.
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px]">
                            <p className="text-xs">Horas-persona por unidad, sumando todos los cargos involucrados. Puedes editar este valor manualmente.</p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    </th>
                    <th className="text-center py-2.5 px-2 font-medium w-[100px]">Subtotal</th>
                    <th className="text-left py-2.5 px-2 font-medium">Cargos</th>
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map(row => (
                    <tr key={row.id} className={`border-b last:border-0 ${row.qty > 0 ? 'bg-indigo-50/30' : ''}`}>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{row.icon}</span>
                          <span className="font-medium capitalize">{row.name.replace(/_/g, ' ')}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={row.qty}
                          onChange={e => setQuantities(prev => ({
                            ...prev,
                            [row.id]: Math.max(0, parseInt(e.target.value) || 0),
                          }))}
                          className="h-8 w-20 text-center mx-auto"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center font-medium">
                        {row.totalQty > 0 ? row.totalQty : '-'}
                      </td>
                      <td className="py-2.5 px-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={overrideHours[row.id] != null ? overrideHours[row.id]! : row.baseHours}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setOverrideHours(prev => ({
                              ...prev,
                              [row.id]: isNaN(val) ? null : val,
                            }));
                          }}
                          className={`h-8 w-20 text-center mx-auto ${!row.hasEstimation ? 'border-amber-300' : ''}`}
                        />
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {row.subtotalHours > 0 ? (
                          <span className="font-semibold text-indigo-600">{Math.round(row.subtotalHours * 10) / 10}h</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        {row.cargos.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.cargos.map(c => (
                              <Badge key={c.cargo} variant="secondary" className="text-[10px] py-0 px-1.5">
                                {c.cargo}: {c.horas}h
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500">Sin datos</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.totalMaterials > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Estimación del Proyecto
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <ResultCard
                label="Total Materiales"
                value={results.totalMaterials.toString()}
                sublabel={`${numSubjects} asignaturas`}
                color="#4F46E5"
              />
              <ResultCard
                label="Horas-Persona"
                value={`${results.totalPersonHours}h`}
                sublabel="Total equipo"
                color="#6366F1"
              />
              <ResultCard
                label="Horas/Persona"
                value={`${results.hoursPerPerson}h`}
                sublabel={`÷ ${teamSize} personas`}
                color="#0DD9D0"
              />
              <ResultCard
                label="Días Laborales"
                value={`${results.workDaysPerPerson}`}
                sublabel={`a ${Math.round(AVG_DAILY_HOURS * 100) / 100}h/día`}
                color="#0dd9d0"
              />
              <ResultCard
                label="Semanas"
                value={`${results.calendarWeeks}`}
                sublabel="Semanas laborales"
                color="#FBBF24"
              />
              <ResultCard
                label="Fecha Estimada"
                value={results.completionDate ? formatDate(results.completionDate) : '-'}
                sublabel="Finalización aprox."
                color="#EF4444"
              />
            </div>

            {/* Visual timeline */}
            <Card className={CARD_CLASS}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Hoy</span>
                  <span>{results.completionDate ? formatDate(results.completionDate) : ''}</span>
                </div>
                <Progress
                  value={0}
                  className="h-3"
                />
                <div className="flex items-center justify-between mt-3 text-sm">
                  <div>
                    <span className="font-medium">{results.totalMaterials}</span>
                    <span className="text-muted-foreground ml-1">materiales</span>
                  </div>
                  <div>
                    <span className="font-medium">{results.totalPersonHours}h</span>
                    <span className="text-muted-foreground ml-1">de trabajo</span>
                  </div>
                  <div>
                    <span className="font-medium">{teamSize}</span>
                    <span className="text-muted-foreground ml-1">personas</span>
                  </div>
                  <div>
                    <span className="font-semibold text-indigo-600">{results.workDaysPerPerson} días</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Warnings */}
            {results.materialsWithoutEstimation > 0 && (
              <Card className={`${CARD_CLASS} border-amber-200 bg-amber-50/50`}>
                <CardContent className="py-3 text-xs text-amber-800 flex items-center gap-2">
                  <Info className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span>
                    <strong>{results.materialsWithoutEstimation}</strong> tipo(s) de material no tienen tiempos estimados en el sistema.
                    Puedes editar la columna "Hrs/Unid." manualmente para incluirlos en el cálculo.
                  </span>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {results.totalMaterials === 0 && (
          <Card className={`${CARD_CLASS} border-dashed`}>
            <CardContent className="py-12 text-center">
              <Calculator className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                Ingresa las cantidades de materiales por asignatura para ver la estimación
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value, sublabel, color }: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <Card className={CARD_CLASS}>
      <CardContent className="pt-4 pb-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{label}</p>
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
      </CardContent>
    </Card>
  );
}
