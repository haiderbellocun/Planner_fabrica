import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export type EstadoRevision = 'sin_iniciar' | 'en_proceso' | 'finalizado';

export interface ChecklistRow {
  asignatura_id: string;
  asignatura_name: string;
  asignatura_code: string | null;
  semestre: number | null;
  programa_id: string | null;
  programa_name: string | null;
  maestro_name: string | null;
  checklist_id: string | null;
  listo_para_revisar: EstadoRevision;
  qa_status: EstadoRevision;
  g1_inf: boolean; g1_vid: boolean; g1_pod: boolean; g1_glos: boolean; g1_fecha: boolean; g1_rev: boolean;
  g2_inf: boolean; g2_vid: boolean; g2_pod: boolean; g2_glos: boolean; g2_fecha: boolean; g2_rev: boolean;
  g3_inf: boolean; g3_vid: boolean; g3_pod: boolean; g3_glos: boolean; g3_fecha: boolean; g3_rev: boolean;
  g4_inf: boolean; g4_vid: boolean; g4_pod: boolean; g4_glos: boolean; g4_fecha: boolean; g4_rev: boolean;
  g5_inf: boolean; g5_vid: boolean; g5_pod: boolean; g5_glos: boolean; g5_fecha: boolean; g5_rev: boolean;
  carga_completa: boolean;
  actividades_moodle: boolean;
  /** Non-admin user checks (blue). Key = field name, value = true if checked by a non-admin. */
  user_checks: Record<string, boolean>;
  updated_at: string | null;
  updated_by_name: string | null;
}

export type ChecklistUpdate = Partial<Omit<ChecklistRow,
  'asignatura_id' | 'asignatura_name' | 'asignatura_code' | 'semestre' |
  'programa_id' | 'programa_name' | 'maestro_name' | 'checklist_id' |
  'updated_at' | 'updated_by_name' | 'user_checks'
>>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const GROUP_KEYS = ['inf', 'vid', 'pod', 'glos', 'fecha', 'rev'] as const;
export type GroupField = typeof GROUP_KEYS[number];

export type CheckState = 'unchecked' | 'blue' | 'green';

/** Returns the visual state of a boolean check field, considering both green (admin) and blue (user) checks. */
export function getCheckState(row: ChecklistRow, field: string): CheckState {
  if ((row as Record<string, unknown>)[field] === true) return 'green';
  if (row.user_checks?.[field] === true) return 'blue';
  return 'unchecked';
}

export function calcEstadoFinal(row: ChecklistRow): 'Sin iniciar' | 'En proceso' | 'Materia Completa' {
  // "Materia Completa" requires all boolean columns TRUE (admin-approved green)
  const allGroupChecks = ([1, 2, 3, 4, 5] as const).every((g) =>
    GROUP_KEYS.every((k) => row[`g${g}_${k}`])
  );
  if (
    allGroupChecks &&
    row.carga_completa &&
    row.actividades_moodle &&
    row.listo_para_revisar === 'finalizado' &&
    row.qa_status === 'finalizado'
  ) return 'Materia Completa';

  // "En proceso" counts blue checks too
  const isAnyChecked = (field: string) =>
    !!(row as Record<string, unknown>)[field] || !!row.user_checks?.[field];

  const anyChecked =
    ([1, 2, 3, 4, 5] as const).some((g) => GROUP_KEYS.some((k) => isAnyChecked(`g${g}_${k}`))) ||
    isAnyChecked('carga_completa') ||
    isAnyChecked('actividades_moodle') ||
    row.listo_para_revisar !== 'sin_iniciar' ||
    row.qa_status !== 'sin_iniciar';

  return anyChecked ? 'En proceso' : 'Sin iniciar';
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useChecklist(projectId: string | undefined) {
  return useQuery({
    queryKey: ['checklist', projectId],
    queryFn: () => api.get<ChecklistRow[]>(`/api/projects/${projectId}/checklist`),
    enabled: !!projectId,
  });
}

export function useUpdateChecklist(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ asignaturaId, data }: { asignaturaId: string; data: ChecklistUpdate }) =>
      api.patch(`/api/checklist/${asignaturaId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] });
    },
    onError: () => {
      toast.error('Error al guardar el checklist');
    },
  });
}

export function useAssignMaestro(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ asignaturaId, maestroId }: { asignaturaId: string; maestroId: string | null }) =>
      api.patch(`/api/asignaturas/${asignaturaId}`, { maestro_id: maestroId ?? '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] });
    },
    onError: () => {
      toast.error('Error al asignar persona');
    },
  });
}
